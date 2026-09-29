import type { GradeParams, SelectiveParams } from "./types";

export const DEFAULT_PARAMS: GradeParams = {
  warmth: 0.22,
  highlightTint: "#E8A87C",
  shadowTint: "#142C3C",
  tintStrength: 0.45,
  saturation: 1.15,

  blackPoint: 14,
  whitePoint: 240,
  gamma: 0.95,
  vignette: 0.4,

  grain: 12,
  grainSize: 0.6,
};

export const DEFAULT_SELECTIVE: SelectiveParams = {
  enabled: false,
  strength: 0.5,
  subjectLumaLow: 0.35,
  subjectLumaHigh: 0.85,
  subjectWarmth: 0.15,
  subjectSaturation: 1.2,
  bgDarken: 0.2,
  bgDesaturate: 0.3,
};

/** Slider range metadata — used by the UI to render controls and clamp values. */
export const PARAM_RANGES = {
  warmth: { min: 0, max: 0.4, step: 0.01 },
  tintStrength: { min: 0, max: 1, step: 0.01 },
  saturation: { min: 0.8, max: 1.5, step: 0.01 },
  blackPoint: { min: 0, max: 50, step: 1 },
  whitePoint: { min: 200, max: 255, step: 1 },
  gamma: { min: 0.8, max: 1.1, step: 0.01 },
  vignette: { min: 0, max: 1, step: 0.01 },
  grain: { min: 0, max: 25, step: 0.5 },
  grainSize: { min: 0.3, max: 1.5, step: 0.05 },
} as const;

export type RangedParam = keyof typeof PARAM_RANGES;
