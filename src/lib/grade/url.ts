/**
 * URL param encoding for GradeParams.
 *
 * Encodes all 11 params into a compact query string like:
 *   ?w=0.22&ht=E8A87C&st=142C3C&ts=0.45&sat=1.15&bp=14&wp=240&g=0.95&v=0.40&gr=12&gs=0.6
 *
 * On load, the store hydrates from the URL first (if present), then falls
 * back to localStorage, then to defaults. This makes shareable links work
 * even across devices.
 */
import type { GradeParams } from "./types";
import { DEFAULT_PARAMS } from "./defaults";

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

/** Read params from the current window location, if present. */
export function readParamsFromLocation(): GradeParams | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#/, "");
  // Prefer hash fragment for shareable links (avoids server round-trips).
  if (hash) {
    const decoded = decodeParamsFromURL(hash);
    return decoded;
  }
  if (window.location.search) {
    return decodeParamsFromURL(window.location.search);
  }
  return null;
}

/** Push the current params into the URL hash (without scrolling). */
export function writeParamsToLocation(p: GradeParams) {
  if (typeof window === "undefined") return;
  const encoded = encodeParamsToURL(p);
  const newHash = "#" + encoded;
  if (window.location.hash !== newHash) {
    // replaceState avoids polluting the back/forward history.
    window.history.replaceState(null, "", newHash);
  }
}

/** Build a fully-qualified shareable URL for the given params. */
export function buildShareURL(p: GradeParams): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}#${encodeParamsToURL(p)}`;
}
