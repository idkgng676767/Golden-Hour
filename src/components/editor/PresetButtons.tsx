"use client";

import { useEditorStore } from "@/store/editor-store";
import type { PresetKey } from "@/lib/grade/types";
import { PRESETS } from "@/lib/grade/presets";
import { DEFAULT_PARAMS } from "@/lib/grade/defaults";
import { cn } from "@/lib/utils";

interface PresetChipProps {
  active: boolean;
  label: string;
  onClick: () => void;
  /** 0..1 relative intensity for the animated bar. */
  intensity: number;
}

function PresetChip({ active, label, onClick, intensity }: PresetChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "card-sheen relative flex-1 overflow-hidden rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all duration-200",
        "active:scale-[0.97]",
        active
          ? "border-amber-brand bg-amber-brand/10 text-amber-brand"
          : "border-border bg-surface text-muted-foreground hover:border-amber-brand/40 hover:text-foreground"
      )}
    >
      <span className="relative z-10">{label}</span>
      {/* Animated intensity bar — width reflects the preset's overall strength */}
      <span
        className="preset-intensity"
        style={{
          width: `${Math.max(8, intensity * 100)}%`,
          opacity: active ? 1 : 0.4,
        }}
        aria-hidden
      />
    </button>
  );
}

/** Compute a 0..1 "intensity" score for a preset based on its key params. */
function presetIntensity(p: typeof DEFAULT_PARAMS): number {
  // Weighted sum of normalized key params.
  const w = p.warmth / 0.4; // 0..1
  const g = p.grain / 25; // 0..1
  const v = p.vignette; // 0..1
  const t = p.tintStrength; // 0..1
  const score = w * 0.35 + g * 0.2 + v * 0.2 + t * 0.25;
  return Math.max(0, Math.min(1, score));
}

/** Detect whether the current params match a preset (for active highlight). */
function matchesPreset(p: typeof DEFAULT_PARAMS, key: PresetKey): boolean {
  if (key === "reset") {
    return (Object.keys(DEFAULT_PARAMS) as (keyof typeof DEFAULT_PARAMS)[]).every(
      (k) => p[k] === DEFAULT_PARAMS[k]
    );
  }
  const preset = PRESETS[key as Exclude<PresetKey, "reset">].params;
  return (Object.keys(preset) as (keyof typeof preset)[]).every(
    (k) => p[k] === preset[k]
  );
}

export function PresetButtons() {
  const params = useEditorStore((s) => s.params);
  const applyPreset = useEditorStore((s) => s.applyPreset);

  return (
    <div className="flex w-full items-center gap-2">
      <PresetChip
        label="Subtle"
        intensity={presetIntensity(PRESETS.subtle.params)}
        active={matchesPreset(params, "subtle")}
        onClick={() => applyPreset("subtle")}
      />
      <PresetChip
        label="Default"
        intensity={presetIntensity(PRESETS.default.params)}
        active={matchesPreset(params, "default")}
        onClick={() => applyPreset("default")}
      />
      <PresetChip
        label="Max"
        intensity={presetIntensity(PRESETS.max.params)}
        active={matchesPreset(params, "max")}
        onClick={() => applyPreset("max")}
      />
      <PresetChip
        label="Reset"
        intensity={presetIntensity({ ...DEFAULT_PARAMS })}
        active={matchesPreset(params, "reset")}
        onClick={() => applyPreset("reset")}
      />
    </div>
  );
}
