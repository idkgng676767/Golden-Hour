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
import type { GradeParams, SelectiveParams } from "./types";
import { DEFAULT_PARAMS, DEFAULT_SELECTIVE } from "./defaults";
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

/** Build a fully-qualified shareable URL for the given params + curves + selective. */
export function buildShareURL(
  p: GradeParams,
  curves?: Curves,
  selective?: SelectiveParams
): string {
  if (typeof window === "undefined") return "";
  let hash = encodeParamsToURL(p);
  if (curves && !isAllCurvesDefault(curves)) {
    hash += "&cv=" + encodeCurvesToURL(curves);
  }
  if (selective && selective.enabled) {
    hash += "&sel=" + encodeSelectiveToURL(selective);
  }
  return `${window.location.origin}${window.location.pathname}#${hash}`;
}

/**
 * Encode selective params into a compact base64 string.
 * 7 numeric params × 2 bytes (quantized 0-65535) + 1 enable byte = 15 bytes.
 */
export function encodeSelectiveToURL(sel: SelectiveParams): string {
  const bytes = new Uint8Array(15);
  // enable flag
  bytes[0] = sel.enabled ? 1 : 0;
  // 7 params × 2 bytes, quantized
  const vals = [
    sel.strength,
    sel.subjectLumaLow,
    sel.subjectLumaHigh,
    sel.subjectWarmth / 0.4, // normalize to 0..1
    (sel.subjectSaturation - 0.5) / 1.5, // normalize to 0..1
    sel.bgDarken,
    sel.bgDesaturate,
  ];
  for (let i = 0; i < 7; i++) {
    const v = Math.round(Math.max(0, Math.min(1, vals[i])) * 65535);
    bytes[1 + i * 2] = (v >> 8) & 0xff;
    bytes[1 + i * 2 + 1] = v & 0xff;
  }
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Decode a base64 selective string back into a SelectiveParams object. */
export function decodeSelectiveFromURL(
  encoded: string,
  base: SelectiveParams = DEFAULT_SELECTIVE
): SelectiveParams {
  try {
    let b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (bytes.length < 15) return { ...base };
    const out: SelectiveParams = { ...base };
    out.enabled = bytes[0] === 1;
    const readVal = (offset: number) => {
      const v = (bytes[offset] << 8) | bytes[offset + 1];
      return v / 65535;
    };
    const v0 = readVal(1);
    const v1 = readVal(3);
    const v2 = readVal(5);
    const v3 = readVal(7);
    const v4 = readVal(9);
    const v5 = readVal(11);
    const v6 = readVal(13);
    out.strength = v0;
    out.subjectLumaLow = v1;
    out.subjectLumaHigh = v2;
    out.subjectWarmth = v3 * 0.4;
    out.subjectSaturation = v4 * 1.5 + 0.5;
    out.bgDarken = v5;
    out.bgDesaturate = v6;
    return out;
  } catch {
    return { ...base };
  }
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

/** Read params AND curves AND selective from the current window location, if present. */
export function readParamsFromLocation(): {
  params: GradeParams | null;
  curves: Curves | null;
  selective: SelectiveParams | null;
} {
  if (typeof window === "undefined")
    return { params: null, curves: null, selective: null };
  const hash = window.location.hash.replace(/^#/, "");
  if (hash) {
    const params = decodeParamsFromURL(hash);
    const cvMatch = hash.match(/(?:^|&)cv=([^&]+)/);
    const curves = cvMatch ? decodeCurvesFromURL(cvMatch[1]) : null;
    const selMatch = hash.match(/(?:^|&)sel=([^&]+)/);
    const selective = selMatch ? decodeSelectiveFromURL(selMatch[1]) : null;
    return { params, curves, selective };
  }
  if (window.location.search) {
    const params = decodeParamsFromURL(window.location.search);
    const cvMatch = window.location.search.match(/(?:^|\?)cv=([^&]+)/);
    const curves = cvMatch ? decodeCurvesFromURL(cvMatch[1]) : null;
    const selMatch = window.location.search.match(/(?:^|\?)sel=([^&]+)/);
    const selective = selMatch ? decodeSelectiveFromURL(selMatch[1]) : null;
    return { params, curves, selective };
  }
  return { params: null, curves: null, selective: null };
}

/** Push params + curves + selective into the URL hash. */
export function writeParamsToLocation(
  p: GradeParams,
  curves?: Curves,
  selective?: SelectiveParams
) {
  if (typeof window === "undefined") return;
  let encoded = encodeParamsToURL(p);
  if (curves && !isAllCurvesDefault(curves)) {
    encoded += "&cv=" + encodeCurvesToURL(curves);
  }
  if (selective && selective.enabled) {
    encoded += "&sel=" + encodeSelectiveToURL(selective);
  }
  const newHash = "#" + encoded;
  if (window.location.hash !== newHash) {
    window.history.replaceState(null, "", newHash);
  }
}
