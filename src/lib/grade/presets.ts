import type { GradeParams, PresetKey } from "./types";
import { DEFAULT_PARAMS } from "./defaults";

export const PRESETS: Record<
  Exclude<PresetKey, "reset">,
  { label: string; params: GradeParams }
> = {
  subtle: {
    label: "Subtle",
    params: { ...DEFAULT_PARAMS, warmth: 0.15, grain: 6, vignette: 0.25, tintStrength: 0.3 },
  },
  default: {
    label: "Default",
    params: { ...DEFAULT_PARAMS },
  },
  max: {
    label: "Max",
    params: { ...DEFAULT_PARAMS, warmth: 0.32, grain: 18, vignette: 0.55, tintStrength: 0.6 },
  },
};

export function getPreset(key: PresetKey): GradeParams {
  if (key === "reset") return { ...DEFAULT_PARAMS };
  return { ...PRESETS[key].params };
}
