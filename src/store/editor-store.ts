"use client";

import { create } from "zustand";
import type { GradeParams, PresetKey } from "@/lib/grade/types";
import { DEFAULT_PARAMS } from "@/lib/grade/defaults";
import { getPreset } from "@/lib/grade/presets";
import {
  readParamsFromLocation,
  writeParamsToLocation,
} from "@/lib/grade/url";
import {
  DEFAULT_CURVES,
  type Curves,
  type CurveChannel,
  cloneCurves,
  isAllCurvesDefault,
} from "@/lib/grade/curve";

const HISTORY_LIMIT = 50;
const STORAGE_KEY = "golden-hour:params:v1";
const CUSTOM_PRESETS_KEY = "golden-hour:custom-presets:v1";

/** A loaded image kept in the store so all components share one source. */
export interface LoadedImage {
  /** Object URL for the original — used by <img> and the WebGL texture. */
  url: string;
  /** Decoded width / height of the original file (for aspect ratio). */
  width: number;
  height: number;
  /** Original file name (for default download name). */
  name: string;
  /** MIME type for info display. */
  type: string;
  /** Size in bytes for info display. */
  size: number;
}

export type Rotation = 0 | 90 | 180 | 270;

/** A user-saved preset (persisted to localStorage). */
export interface CustomPreset {
  id: string;
  name: string;
  params: GradeParams;
  createdAt: number;
}

interface EditorState {
  // --- image ---
  image: LoadedImage | null;
  setImage: (img: LoadedImage | null) => void;
  rotation: Rotation;
  setRotation: (r: Rotation) => void;
  rotateCW: () => void;

  // --- params ---
  params: GradeParams;
  setParam: <K extends keyof GradeParams>(key: K, value: GradeParams[K]) => void;
  applyPreset: (key: PresetKey) => void;
  applyParams: (p: GradeParams, commit?: boolean) => void;

  // --- curves (tone curve editor) ---
  curves: Curves;
  setCurvePoint: (
    channel: "master" | "r" | "g" | "b",
    index: number,
    y: number
  ) => void;
  resetCurves: () => void;
  /** Active curve channel being edited in the UI. */
  activeCurveChannel: "master" | "r" | "g" | "b";
  setActiveCurveChannel: (c: "master" | "r" | "g" | "b") => void;

  // --- custom presets ---
  customPresets: CustomPreset[];
  saveCustomPreset: (name: string) => void;
  deleteCustomPreset: (id: string) => void;

  // --- history ---
  past: GradeParams[];
  future: GradeParams[];
  undo: () => void;
  redo: () => void;
  /** Push the *current* params onto the history stack (call BEFORE mutating). */
  commit: () => void;

  // --- UI ---
  /** 0..1 position of the before/after slider handle. */
  sliderPos: number;
  setSliderPos: (p: number) => void;
  /** Whether the user is currently dragging the slider. */
  isComparing: boolean;
  setComparing: (v: boolean) => void;
  /** Format the download button exports. */
  exportFormat: "jpeg" | "png";
  setExportFormat: (f: "jpeg" | "png") => void;
  /** Modal toggles. */
  compareOpen: boolean;
  setCompareOpen: (v: boolean) => void;
  helpOpen: boolean;
  setHelpOpen: (v: boolean) => void;
  /** URL-sync toggle — when true, params are mirrored to the URL hash. */
  urlSync: boolean;
  setUrlSync: (v: boolean) => void;
  /**
   * Shared ref to the live preview renderer. Set by ImageCanvas, read by the
   * Histogram for pixel-perfect readPixels-based grading. We store a getter
   * function rather than the ref itself so Zustand doesn't deep-compare it.
   */
  rendererGetter: (() => unknown) | null;
  setRendererGetter: (fn: (() => unknown) | null) => void;

  // --- persistence ---
  hydrateFromStorage: () => void;
  hydrateFromURL: () => boolean;
}

function loadFromStorage(): GradeParams | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GradeParams>;
    return { ...DEFAULT_PARAMS, ...parsed };
  } catch {
    return null;
  }
}

function saveToStorage(p: GradeParams) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* ignore quota errors */
  }
}

function loadCustomPresets(): CustomPreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_PRESETS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CustomPreset[];
  } catch {
    return [];
  }
}

function saveCustomPresets(list: CustomPreset[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export const useEditorStore = create<EditorState>((set, get) => ({
  image: null,
  setImage: (image) => set({ image, rotation: 0 }),
  rotation: 0,
  setRotation: (rotation) => set({ rotation }),
  rotateCW: () =>
    set((s) => ({
      rotation: ((s.rotation + 90) % 360) as Rotation,
    })),

  params: { ...DEFAULT_PARAMS },
  setParam: (key, value) => {
    const next = { ...get().params, [key]: value };
    set({ params: next });
    saveToStorage(next);
    if (get().urlSync) writeParamsToLocation(next, get().curves);
  },
  applyPreset: (key) => {
    const preset = getPreset(key);
    const past = [...get().past, get().params];
    if (past.length > HISTORY_LIMIT) past.shift();
    set({ params: preset, past, future: [] });
    saveToStorage(preset);
    if (get().urlSync) writeParamsToLocation(preset, get().curves);
  },
  applyParams: (p, commit = true) => {
    const past = commit ? [...get().past, get().params].slice(-HISTORY_LIMIT) : get().past;
    set({ params: p, past, future: [] });
    saveToStorage(p);
    if (get().urlSync) writeParamsToLocation(p, get().curves);
  },

  // --- curves ---
  curves: cloneCurves(DEFAULT_CURVES),
  setCurvePoint: (channel, index, y) => {
    const clamped = Math.max(0, Math.min(1, y));
    const next = cloneCurves(get().curves);
    const ch = next[channel];
    // Don't allow moving endpoints off the diagonal extremes.
    if (index === 0) {
      ch.points[0] = 0; // locked at 0
      return;
    }
    if (index === 4) {
      ch.points[4] = 1; // locked at 1
      return;
    }
    ch.points[index] = clamped;
    // Keep monotonic-ish: ensure neighbors aren't crossed.
    if (index > 0 && ch.points[index] < ch.points[index - 1]) {
      ch.points[index - 1] = ch.points[index];
    }
    if (index < 4 && ch.points[index] > ch.points[index + 1]) {
      ch.points[index + 1] = ch.points[index];
    }
    set({ curves: next });
    if (get().urlSync) writeParamsToLocation(get().params, next);
  },
  resetCurves: () => {
    set({ curves: cloneCurves(DEFAULT_CURVES) });
    if (get().urlSync) writeParamsToLocation(get().params, DEFAULT_CURVES);
  },
  activeCurveChannel: "master",
  setActiveCurveChannel: (activeCurveChannel) => set({ activeCurveChannel }),

  customPresets: typeof window !== "undefined" ? loadCustomPresets() : [],
  saveCustomPreset: (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const preset: CustomPreset = {
      id: `cp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed.slice(0, 32),
      params: { ...get().params },
      createdAt: Date.now(),
    };
    const list = [preset, ...get().customPresets].slice(0, 12);
    set({ customPresets: list });
    saveCustomPresets(list);
  },
  deleteCustomPreset: (id) => {
    const list = get().customPresets.filter((p) => p.id !== id);
    set({ customPresets: list });
    saveCustomPresets(list);
  },

  past: [],
  future: [],
  commit: () => {
    const past = [...get().past, get().params];
    if (past.length > HISTORY_LIMIT) past.shift();
    set({ past, future: [] });
  },
  undo: () => {
    const { past, params, future } = get();
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);
    set({
      params: previous,
      past: newPast,
      future: [params, ...future],
    });
    saveToStorage(previous);
    if (get().urlSync) writeParamsToLocation(previous, get().curves);
  },
  redo: () => {
    const { future, params, past } = get();
    if (future.length === 0) return;
    const next = future[0];
    set({
      params: next,
      past: [...past, params],
      future: future.slice(1),
    });
    saveToStorage(next);
    if (get().urlSync) writeParamsToLocation(next, get().curves);
  },

  sliderPos: 0.5,
  setSliderPos: (sliderPos) => set({ sliderPos }),
  isComparing: false,
  setComparing: (isComparing) => set({ isComparing }),

  exportFormat: "jpeg",
  setExportFormat: (exportFormat) => set({ exportFormat }),

  compareOpen: false,
  setCompareOpen: (compareOpen) => set({ compareOpen }),
  helpOpen: false,
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  urlSync: true,
  setUrlSync: (urlSync) => set({ urlSync }),

  rendererGetter: null,
  setRendererGetter: (rendererGetter) => set({ rendererGetter }),

  hydrateFromStorage: () => {
    const stored = loadFromStorage();
    if (stored) set({ params: stored });
  },
  hydrateFromURL: () => {
    const { params, curves } = readParamsFromLocation();
    if (params) {
      set({ params });
      saveToStorage(params);
      if (curves) set({ curves });
      return true;
    }
    return false;
  },
}));
