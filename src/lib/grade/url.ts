/**
 * URL param encoding for GradeParams + Curves.
 *
 * Encodes all 11 params into a compact query string like:
 *   ?w=0.22&ht=E8A87C&st=142C3C&ts=0.45&sat=1.15&bp=14&wp=240&g=0.95&v=0.40&gr=12&gs=0.6
 *
 * Curves (if non-default) are appended as a compact base64 segment:
 *   &cv=<base64>  where the base64 encodes 4 channels × 5 points × 2 bytes.
 *
 * On load, the store hydrates from the URL first (if present), then falls
 * back to localStorage, then to defaults. This makes shareable links work
 * even across devices.
 */
import type { GradeParams } from "./types";
import { DEFAULT_PARAMS } from "./defaults";
import { DEFAULT_CURVES, type Curves, isAllCurvesDefault, cloneCurves } from "./curve";

/** Short keys for compact URLs. */
const KEY_MAP = {
  warmth: "w",
  highlightTint: "ht",
  shadowTint: "st",
  tintStrength: "ts",
  saturation: "sat",
  blackPoint: "bp",
  whitePoint: "wp",
  gamma: "g",
  vignette: "v",
  grain: "gr",
  grainSize: "gs",
} as const;

const REVERSE_MAP: Record<string, keyof typeof KEY_MAP> = Object.entries(
  KEY_MAP
).reduce(
  (acc, [k, v]) => {
    acc[v] = k as keyof typeof KEY_MAP;
    return acc;
  },
  {} as Record<string, keyof typeof KEY_MAP>
);

/** Encode GradeParams → query string (without the leading `?`). */
export function encodeParamsToURL(p: GradeParams): string {
  const parts: string[] = [];
  // Normalize tints to uppercase hex without #.
  const ht = p.highlightTint.replace("#", "").toUpperCase();
  const st = p.shadowTint.replace("#", "").toUpperCase();
  const norm: GradeParams = { ...p, highlightTint: ht, shadowTint: st };
  (Object.keys(KEY_MAP) as (keyof typeof KEY_MAP)[]).forEach((k) => {
    const v = norm[k];
    const short = KEY_MAP[k];
    if (typeof v === "number") {
      // Trim trailing zeros for compactness.
      parts.push(`${short}=${v}`);
    } else {
      parts.push(`${short}=${v}`);
    }
  });
  return parts.join("&");
}

/** Decode a query string (with or without leading `?`) into GradeParams. */
export function decodeParamsFromURL(
  query: string,
  base: GradeParams = DEFAULT_PARAMS
): GradeParams {
  const clean = query.replace(/^\?/, "").trim();
  if (!clean) return { ...base };
  const out: GradeParams = { ...base };
  for (const pair of clean.split("&")) {
    const [rawKey, rawVal] = pair.split("=");
    if (!rawKey || rawVal === undefined) continue;
    const fullKey = REVERSE_MAP[rawKey];
    if (!fullKey) continue;
    const val = decodeURIComponent(rawVal);
    if (fullKey === "highlightTint" || fullKey === "shadowTint") {
      // Accept with or without #, case-insensitive.
      const hex = val.startsWith("#") ? val : "#" + val.toUpperCase();
      if (/^#[0-9A-F]{6}$/i.test(hex)) {
        out[fullKey] = hex;
      }
    } else {
      const num = parseFloat(val);
      if (!Number.isNaN(num)) {
        (out as Record<string, number>)[fullKey] = num;
      }
    }
  }
  return out;
}

/** Build a fully-qualified shareable URL for the given params. */
export function buildShareURL(p: GradeParams, curves?: Curves): string {
  if (typeof window === "undefined") return "";
  let hash = encodeParamsToURL(p);
  if (curves && !isAllCurvesDefault(curves)) {
    hash += "&cv=" + encodeCurvesToURL(curves);
  }
  return `${window.location.origin}${window.location.pathname}#${hash}`;
}

/**
 * Encode curves into a compact base64 string.
 * 4 channels × 5 points, each point quantized to 0-255 (1 byte).
 * Total: 20 bytes → ~28 chars base64. Only non-default curves are encoded.
 */
export function encodeCurvesToURL(curves: Curves): string {
  const bytes = new Uint8Array(20);
  let i = 0;
  const channels: (keyof Curves)[] = ["master", "r", "g", "b"];
  for (const ch of channels) {
    for (const p of curves[ch].points) {
      bytes[i++] = Math.round(Math.max(0, Math.min(1, p)) * 255);
    }
  }
  // Convert to base64 (URL-safe).
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Decode a base64 curve string back into a Curves object. */
export function decodeCurvesFromURL(
  encoded: string,
  base: Curves = DEFAULT_CURVES
): Curves {
  try {
    // Restore standard base64.
    let b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (bytes.length < 20) return cloneCurves(base);
    const out = cloneCurves(base);
    let i = 0;
    const channels: (keyof Curves)[] = ["master", "r", "g", "b"];
    for (const ch of channels) {
      const pts = out[ch].points;
      for (let j = 0; j < 5; j++) {
        pts[j] = bytes[i++] / 255;
      }
    }
    return out;
  } catch {
    return cloneCurves(base);
  }
}

/** Read params AND curves from the current window location, if present. */
export function readParamsFromLocation(): { params: GradeParams | null; curves: Curves | null } {
  if (typeof window === "undefined") return { params: null, curves: null };
  const hash = window.location.hash.replace(/^#/, "");
  if (hash) {
    const params = decodeParamsFromURL(hash);
    // Extract curves if present.
    const cvMatch = hash.match(/(?:^|&)cv=([^&]+)/);
    const curves = cvMatch ? decodeCurvesFromURL(cvMatch[1]) : null;
    return { params, curves };
  }
  if (window.location.search) {
    const params = decodeParamsFromURL(window.location.search);
    const cvMatch = window.location.search.match(/(?:^|\?)cv=([^&]+)/);
    const curves = cvMatch ? decodeCurvesFromURL(cvMatch[1]) : null;
    return { params, curves };
  }
  return { params: null, curves: null };
}

/** Push params + curves into the URL hash. */
export function writeParamsToLocation(p: GradeParams, curves?: Curves) {
  if (typeof window === "undefined") return;
  let encoded = encodeParamsToURL(p);
  if (curves && !isAllCurvesDefault(curves)) {
    encoded += "&cv=" + encodeCurvesToURL(curves);
  }
  const newHash = "#" + encoded;
  if (window.location.hash !== newHash) {
    window.history.replaceState(null, "", newHash);
  }
}
