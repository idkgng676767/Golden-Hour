"use client";

import { create } from "zustand";
import type { GradeParams, PresetKey } from "@/lib/grade/types";
import { DEFAULT_PARAMS } from "@/lib/grade/defaults";
import { getPreset } from "@/lib/grade/presets";

const HISTORY_LIMIT = 50;
const STORAGE_KEY = "golden-hour:params:v1";

/** A loaded image kept in the store so all components share one source. */
export interface LoadedImage {
  /** Object URL for the original — used by <img> and the WebGL texture. */
  url: string;
  /** Decoded width / height of the original file (for aspect ratio). */
  width: number;
  height: number;
  /** Original file name (for default download name). */
  name: string;
}

interface EditorState {
  // --- image ---
  image: LoadedImage | null;
  setImage: (img: LoadedImage | null) => void;

  // --- params ---
  params: GradeParams;
  setParam: <K extends keyof GradeParams>(key: K, value: GradeParams[K]) => void;
  applyPreset: (key: PresetKey) => void;

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

  // --- persistence ---
  hydrateFromStorage: () => void;
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

export const useEditorStore = create<EditorState>((set, get) => ({
  image: null,
  setImage: (image) => set({ image }),

  params: { ...DEFAULT_PARAMS },
  setParam: (key, value) => {
    const next = { ...get().params, [key]: value };
    set({ params: next });
    saveToStorage(next);
  },
  applyPreset: (key) => {
    const preset = getPreset(key);
    // Preset application is a committed action — snapshot the previous params.
    const past = [...get().past, get().params];
    if (past.length > HISTORY_LIMIT) past.shift();
    set({ params: preset, past, future: [] });
    saveToStorage(preset);
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
  },

  sliderPos: 0.5,
  setSliderPos: (sliderPos) => set({ sliderPos }),
  isComparing: false,
  setComparing: (isComparing) => set({ isComparing }),

  exportFormat: "jpeg",
  setExportFormat: (exportFormat) => set({ exportFormat }),

  hydrateFromStorage: () => {
    const stored = loadFromStorage();
    if (stored) set({ params: stored });
  },
}));
