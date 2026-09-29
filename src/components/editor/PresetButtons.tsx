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
  accent: string;
}

function PresetChip({ active, label, onClick, accent }: PresetChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all duration-200",
        "active:scale-[0.97]",
        active
          ? "border-amber-brand bg-amber-brand/10 text-amber-brand"
          : "border-border bg-surface text-muted-foreground hover:border-amber-brand/40 hover:text-foreground"
      )}
      style={active ? { boxShadow: `inset 0 0 0 1px ${accent}55` } : undefined}
    >
      {label}
    </button>
  );
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
        accent="#E8A87C"
        active={matchesPreset(params, "subtle")}
        onClick={() => applyPreset("subtle")}
      />
      <PresetChip
        label="Default"
        accent="#E8A87C"
        active={matchesPreset(params, "default")}
        onClick={() => applyPreset("default")}
      />
      <PresetChip
        label="Max"
        accent="#E8A87C"
        active={matchesPreset(params, "max")}
        onClick={() => applyPreset("max")}
      />
      <PresetChip
        label="Reset"
        accent="#fda4af"
        active={matchesPreset(params, "reset")}
        onClick={() => applyPreset("reset")}
      />
    </div>
  );
}
