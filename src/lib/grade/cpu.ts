/**
 * CPU fallback grade — mirrors the WebGL shader pass-for-pass.
 *
 * Used when WebGL is unavailable, and also for full-res export when the
 * user prefers in-browser processing. Operates directly on ImageData
 * (Uint8ClampedArray) so it can run inside a Web Worker.
 *
 * For live preview we prefer WebGL (50× faster). This path is correct but
 * slow on big images — always downsample first.
 */

import type { GradeParams } from "./types";
import { hexToRgb, clamp } from "./color";

export interface GradeResult {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Box-blur a single-channel Float32Array (in place). radius in px. */
function boxBlur(
  arr: Float32Array,
  w: number,
  h: number,
  radius: number
): Float32Array {
  if (radius < 0.5) return arr;
  const r = Math.max(1, Math.round(radius));
  const out = new Float32Array(arr.length);
  const tmp = new Float32Array(arr.length);

  // Horizontal pass
  for (let y = 0; y < h; y++) {
    let sum = 0;
    const row = y * w;
    for (let x = -r; x <= r; x++) {
      sum += arr[row + clamp(x, 0, w - 1)];
    }
    const denom = 2 * r + 1;
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / denom;
      const xOut = clamp(x - r, 0, w - 1);
      const xIn = clamp(x + r + 1, 0, w - 1);
      sum += arr[row + xIn] - arr[row + xOut];
    }
  }
  // Vertical pass
  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let y = -r; y <= r; y++) {
      sum += tmp[clamp(y, 0, h - 1) * w + x];
    }
    const denom = 2 * r + 1;
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / denom;
      const yOut = clamp(y - r, 0, h - 1);
      const yIn = clamp(y + r + 1, 0, h - 1);
      sum += tmp[yIn * w + x] - tmp[yOut * w + x];
    }
  }
  return out;
}

/** Generate monochromatic Gaussian noise via Box-Muller, then blur. */
function generateGrain(
  w: number,
  h: number,
  std: number,
  blurRadius: number
): Float32Array {
  const n = w * h;
  const noise = new Float32Array(n);
  // Box-Muller transform → Gaussian samples.
  for (let i = 0; i < n; i += 2) {
    const u1 = Math.max(1e-7, Math.random());
    const u2 = Math.random();
    const mag = std * Math.sqrt(-2.0 * Math.log(u1));
    noise[i] = mag * Math.cos(2 * Math.PI * u2);
    if (i + 1 < n) noise[i + 1] = mag * Math.sin(2 * Math.PI * u2);
  }
  return boxBlur(noise, w, h, blurRadius);
}

export function gradeImageData(
  src: ImageData,
  params: GradeParams,
  options: { animateGrain?: boolean } = {}
): ImageData {
  const { width: w, height: h, data } = src;
  const out = new Uint8ClampedArray(data.length);
  out.set(data);

  const {
    warmth,
    blackPoint,
    whitePoint,
    gamma,
    tintStrength,
    saturation,
    vignette,
    grain,
    grainSize,
  } = params;

  const hiTint = hexToRgb(params.highlightTint);
  const shTint = hexToRgb(params.shadowTint);

  const scale = 255 / Math.max(1, whitePoint - blackPoint);

  // ---- Pass 1+2+3+4: per-pixel color transforms -----------------------
  for (let i = 0; i < out.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Pass 1: warm white balance
    r = r * (1 + warmth * 0.4) + warmth * 6;
    g = g * (1 - warmth * 0.15) + warmth * 12;
    b = b * (1 - warmth * 0.55) + warmth * 4;

    // Pass 2: levels + gamma
    const applyLevel = (v: number) => {
      let x = clamp((v - blackPoint) * scale, 0, 255) / 255;
      x = Math.pow(x, gamma);
      return x * 255;
    };
    r = applyLevel(r);
    g = applyLevel(g);
    b = applyLevel(b);

    // Pass 3: split-tone
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    let hiMask = clamp((lum - 110) / 145, 0, 1);
    hiMask = Math.pow(hiMask, 1.5);
    let shMask = clamp((140 - lum) / 140, 0, 1);
    shMask = Math.pow(shMask, 1.5);
    const hiAmt = hiMask * tintStrength;
    const shAmt = shMask * tintStrength;
    r = r * (1 - hiAmt) + hiTint.r * hiAmt;
    g = g * (1 - hiAmt) + hiTint.g * hiAmt;
    b = b * (1 - hiAmt) + hiTint.b * hiAmt;
    r = r * (1 - shAmt) + shTint.r * shAmt;
    g = g * (1 - shAmt) + shTint.g * shAmt;
    b = b * (1 - shAmt) + shTint.b * shAmt;

    // Pass 4: saturation (luminance-preserving)
    const lum2 = 0.299 * r + 0.587 * g + 0.114 * b;
    r = lum2 + (r - lum2) * saturation;
    g = lum2 + (g - lum2) * saturation;
    b = lum2 + (b - lum2) * saturation;

    out[i] = r;
    out[i + 1] = g;
    out[i + 2] = b;
    out[i + 3] = data[i + 3];
  }

  // ---- Pass 5: vignette -----------------------------------------------
  if (vignette > 0) {
    const cx = (w - 1) / 2;
    const cy = (h - 1) / 2;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (x - cx) / cx;
        const dy = (y - cy) / cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const mask = 1 - vignette * Math.pow(clamp(dist, 0, 1), 2.3);
        const i = (y * w + x) * 4;
        out[i] *= mask;
        out[i + 1] *= mask;
        out[i + 2] *= mask;
      }
    }
  }

  // ---- Pass 6: film grain ---------------------------------------------
  if (grain > 0) {
    // std = grain; blur radius scales with grainSize (matches Python).
    const blurRadius = grainSize * 1.5;
    // Suppress unused-var warning if animateGrain ever drives seed later.
    void options.animateGrain;
    const noise = generateGrain(w, h, grain, blurRadius);
    for (let i = 0; i < out.length; i += 4) {
      const r = out[i];
      const g = out[i + 1];
      const b = out[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      let lumaMask = clamp(1 - Math.abs(lum - 128) / 128, 0, 1);
      lumaMask = Math.pow(lumaMask, 0.6);
      const delta = noise[i >> 2] * lumaMask;
      out[i] = clamp(r + delta, 0, 255);
      out[i + 1] = clamp(g + delta, 0, 255);
      out[i + 2] = clamp(b + delta, 0, 255);
    }
  }

  return new ImageData(out, w, h);
}
