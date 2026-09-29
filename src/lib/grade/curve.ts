/**
 * Tone curve math — Catmull-Rom interpolation through control points.
 *
 * A curve is defined by 5 control points at fixed x positions (0, 64, 128,
 * 192, 255). The user drags the y values; we interpolate to a 256-entry LUT
 * that the shader samples as a 1D texture.
 *
 * Four curves: master (applied to R/G/B equally), then per-channel R, G, B.
 */

export interface CurveChannel {
  /** 5 y values at x = 0, 64, 128, 192, 255. Range 0..1. */
  points: [number, number, number, number, number];
}

export interface Curves {
  master: CurveChannel;
  r: CurveChannel;
  g: CurveChannel;
  b: CurveChannel;
}

/** Default = identity (each y = x/255). */
export const DEFAULT_CURVES: Curves = {
  master: { points: [0, 0.25, 0.5, 0.75, 1] },
  r: { points: [0, 0.25, 0.5, 0.75, 1] },
  g: { points: [0, 0.25, 0.5, 0.75, 1] },
  b: { points: [0, 0.25, 0.5, 0.75, 1] },
};

/** X positions of the 5 control points. */
export const CURVE_X: readonly number[] = [0, 64, 128, 192, 255];

/** Catmull-Rom spline interpolation between 4 control points. */
function catmullRom(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number
): number {
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

/**
 * Build a 256-entry LUT from a curve's 5 control points.
 * Endpoints are clamped to the first/last point (no extrapolation).
 */
export function buildLUT(channel: CurveChannel): Uint8Array {
  const pts = channel.points;
  const lut = new Uint8Array(256);
  // Sample each of the 4 segments.
  for (let seg = 0; seg < 4; seg++) {
    const p0 = seg > 0 ? pts[seg - 1] : pts[seg]; // clamp at start
    const p1 = pts[seg];
    const p2 = pts[seg + 1];
    const p3 = seg < 3 ? pts[seg + 2] : pts[seg + 1]; // clamp at end
    const segStart = CURVE_X[seg];
    const segEnd = CURVE_X[seg + 1];
    const segLen = segEnd - segStart;
    for (let x = segStart; x < segEnd; x++) {
      const t = (x - segStart) / segLen;
      let v = catmullRom(p0, p1, p2, p3, t);
      v = Math.max(0, Math.min(1, v));
      lut[x] = Math.round(v * 255);
    }
  }
  // Last entry (x=255) = last control point.
  lut[255] = Math.round(Math.max(0, Math.min(1, pts[4])) * 255);
  return lut;
}

/**
 * Build a combined 256×4 LUT texture data (RGBA) for the shader.
 * - R channel = master curve applied to R, then R curve
 * - We pack 4 separate 256-entry LUTs into one 256×4 texture:
 *   row 0 = master LUT (applied to all channels first)
 *   row 1 = R LUT, row 2 = G LUT, row 3 = B LUT
 */
export function buildCombinedLUT(curves: Curves): Uint8Array {
  const master = buildLUT(curves.master);
  const r = buildLUT(curves.r);
  const g = buildLUT(curves.g);
  const b = buildLUT(curves.b);
  // Pack as 256×4 (width=256, height=4), RGBA per pixel but we use
  // each row as a separate 1D LUT. Actually simpler: one 256×1 RGBA
  // texture where R=master-R-composite, G=master-G, B=master-B, A=1.
  // But we need per-channel after master. So: 256×4 texture, row per LUT.
  const out = new Uint8Array(256 * 4 * 4); // 256 wide × 4 rows × 4 bytes
  for (let x = 0; x < 256; x++) {
    // Row 0 = master LUT (stored in R of each pixel)
    out[x * 4 + 0] = master[x];
    out[x * 4 + 1] = master[x];
    out[x * 4 + 2] = master[x];
    out[x * 4 + 3] = 255;
    // Row 1 = R LUT, row 2 = G LUT, row 3 = B LUT
    out[(256 + x) * 4 + 0] = r[x];
    out[(256 + x) * 4 + 1] = 0;
    out[(256 + x) * 4 + 2] = 0;
    out[(256 + x) * 4 + 3] = 255;
    out[(512 + x) * 4 + 0] = 0;
    out[(512 + x) * 4 + 1] = g[x];
    out[(512 + x) * 4 + 2] = 0;
    out[(512 + x) * 4 + 3] = 255;
    out[(768 + x) * 4 + 0] = 0;
    out[(768 + x) * 4 + 1] = 0;
    out[(768 + x) * 4 + 2] = b[x];
    out[(768 + x) * 4 + 3] = 255;
  }
  return out;
}

/** Is a curve at its default (identity) state? */
export function isCurveDefault(c: CurveChannel): boolean {
  return c.points.every((p, i) => Math.abs(p - [0, 0.25, 0.5, 0.75, 1][i]) < 0.005);
}

export function isAllCurvesDefault(curves: Curves): boolean {
  return (
    isCurveDefault(curves.master) &&
    isCurveDefault(curves.r) &&
    isCurveDefault(curves.g) &&
    isCurveDefault(curves.b)
  );
}

/** Deep clone a Curves object. */
export function cloneCurves(c: Curves): Curves {
  return {
    master: { points: [...c.master.points] as CurveChannel["points"] },
    r: { points: [...c.r.points] as CurveChannel["points"] },
    g: { points: [...c.g.points] as CurveChannel["points"] },
    b: { points: [...c.b.points] as CurveChannel["points"] },
  };
}
