/**
 * GradeParams — every knob the user can turn.
 * All values mirror the Python reference exactly (see project spec).
 */
export interface GradeParams {
  // Color
  warmth: number; // 0..0.4, default 0.22
  highlightTint: string; // hex "#E8A87C"
  shadowTint: string; // hex "#142C3C"
  tintStrength: number; // 0..1, default 0.45
  saturation: number; // 0.8..1.5, default 1.15

  // Tone
  blackPoint: number; // 0..50, default 14
  whitePoint: number; // 200..255, default 240
  gamma: number; // 0.8..1.1, default 0.95
  vignette: number; // 0..1, default 0.40

  // Texture
  grain: number; // 0..25, default 12
  grainSize: number; // 0.3..1.5, default 0.6
}

/** A live histogram computed from a downscaled preview, 3 channels × 64 bins. */
export interface Histogram {
  r: number[];
  g: number[];
  b: number[];
}

export type PresetKey = "subtle" | "default" | "max" | "reset";
