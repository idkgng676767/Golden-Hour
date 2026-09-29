"use client";

import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/store/editor-store";
import type { Histogram } from "@/lib/grade/types";
import type { GradeRenderer } from "@/lib/grade/renderer";
import { gradeImageData } from "@/lib/grade/cpu";
import { cn } from "@/lib/utils";
import { Layers, BarChart3 } from "lucide-react";

const BINS = 64;
const HIST_W = 240;
const HIST_H = 56;
const PARADE_ROW_H = 18; // per-channel row height in parade mode

/** Build a histogram from raw RGBA pixels (post-grade). */
function buildHistogram(data: Uint8Array | Uint8ClampedArray): Histogram {
  const r = new Array(BINS).fill(0);
  const g = new Array(BINS).fill(0);
  const b = new Array(BINS).fill(0);
  for (let i = 0; i < data.length; i += 4) {
    r[Math.min(BINS - 1, (data[i] / 256) | 0)]++;
    g[Math.min(BINS - 1, (data[i + 1] / 256) | 0)]++;
    b[Math.min(BINS - 1, (data[i + 2] / 256) | 0)]++;
  }
  return { r, g, b };
}

/**
 * Compute clipping stats — fraction of pixels that are blown out
 * (highlights) or crushed (blacks). Threshold is configurable.
 */
function computeClipping(
  data: Uint8Array | Uint8ClampedArray,
  threshold: number
): {
  highlightClipped: number;
  shadowClipped: number;
} {
  let hi = 0;
  let sh = 0;
  const total = data.length / 4;
  const hiThreshold = 255 - threshold;
  const shThreshold = threshold;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] >= hiThreshold && data[i + 1] >= hiThreshold && data[i + 2] >= hiThreshold)
      hi++;
    if (data[i] <= shThreshold && data[i + 1] <= shThreshold && data[i + 2] <= shThreshold)
      sh++;
  }
  return {
    highlightClipped: hi / total,
    shadowClipped: sh / total,
  };
}

/** Downscale an image to ~96px longest side for the CPU fallback path. */
async function downscaleToImageData(url: string, maxDim = 96): Promise<ImageData | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const factor = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * factor));
      const h = Math.max(1, Math.round(img.naturalHeight * factor));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      resolve(ctx.getImageData(0, 0, w, h));
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

type HistogramMode = "overlay" | "parade";

/**
 * Histogram — live RGB histogram of the graded preview.
 *
 * Two display modes:
 *   - **overlay**: all 3 channels drawn on one graph with screen blend
 *   - **parade**: 3 stacked rows (R/G/B) like DaVinci Resolve's parade scope
 *
 * Clipping indicators (zebra stripes + S/H badges) use a configurable
 * threshold (default 5, adjustable 1-20).
 */
export function Histogram() {
  const image = useEditorStore((s) => s.image);
  const params = useEditorStore((s) => s.params);
  const curves = useEditorStore((s) => s.curves);
  const rotation = useEditorStore((s) => s.rotation);
  const rendererGetter = useEditorStore((s) => s.rendererGetter);
  const [hist, setHist] = useState<Histogram | null>(null);
  const [clipping, setClipping] = useState<{
    highlightClipped: number;
    shadowClipped: number;
  } | null>(null);
  const [mode, setMode] = useState<HistogramMode>("overlay");
  const [clipThreshold, setClipThreshold] = useState(5);
  const originalRef = useRef<ImageData | null>(null);

  // Re-decode the small original (for CPU fallback) when the image changes.
  useEffect(() => {
    let cancelled = false;
    if (!image) {
      originalRef.current = null;
      return;
    }
    downscaleToImageData(image.url, 96).then((d) => {
      if (cancelled) return;
      originalRef.current = d;
    });
    return () => {
      cancelled = true;
    };
  }, [image]);

  // Recompute the histogram (debounced) on param/curve/rotation/threshold change.
  useEffect(() => {
    if (!image) return;
    const t = setTimeout(() => {
      const renderer = rendererGetter?.() as GradeRenderer | null;
      if (renderer && (renderer as GradeRenderer).readDownscaledPixels) {
        const pixels = renderer.readDownscaledPixels(96);
        if (pixels) {
          setHist(buildHistogram(pixels));
          setClipping(computeClipping(pixels, clipThreshold));
          return;
        }
      }
      if (!originalRef.current) return;
      const graded = gradeImageData(originalRef.current!, params);
      setHist(buildHistogram(graded.data));
      setClipping(computeClipping(graded.data, clipThreshold));
    }, 120);
    return () => clearTimeout(t);
  }, [params, curves, image, rotation, rendererGetter, clipThreshold]);

  if (!hist) return null;

  const binW = HIST_W / BINS;

  const pathFor = (channel: "r" | "g" | "b", height: number) => {
    const arr = hist[channel];
    const smoothed = arr.map((v, i) => {
      const a = arr[Math.max(0, i - 1)] || 0;
      const b = arr[Math.min(arr.length - 1, i + 1)] || 0;
      return Math.max(v, a * 0.5, b * 0.5);
    });
    const m = Math.max(...smoothed, 1);
    let d = "";
    smoothed.forEach((v, i) => {
      const x = i * binW + binW / 2;
      const y = height - (v / m) * (height - 2) - 1;
      d += i === 0 ? `M${x.toFixed(2)},${y.toFixed(2)}` : ` L${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return d;
  };

  // Clipping display
  const shadowClipX = (clipThreshold / 255) * HIST_W;
  const highlightClipX = HIST_W - shadowClipX;
  const clipWidth = shadowClipX;
  const hasHighlightClip = clipping && clipping.highlightClipped > 0.001;
  const hasShadowClip = clipping && clipping.shadowClipped > 0.001;

  const paradeHeight = PARADE_ROW_H * 3 + 4;

  return (
    <div className="rounded-lg border border-border bg-surface/60 p-2.5">
      {/* Header with mode toggle + clipping indicators */}
      <div className="mb-1.5 flex items-center justify-between gap-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Histogram
          </span>
          {/* Mode toggle */}
          <div className="flex overflow-hidden rounded-md border border-border">
            <button
              type="button"
              onClick={() => setMode("overlay")}
              className={cn(
                "grid h-5 w-5 place-items-center transition-colors",
                mode === "overlay"
                  ? "bg-amber-brand/15 text-amber-brand"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Overlay mode"
              aria-label="Overlay mode"
            >
              <BarChart3 className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={() => setMode("parade")}
              className={cn(
                "grid h-5 w-5 place-items-center transition-colors",
                mode === "parade"
                  ? "bg-amber-brand/15 text-amber-brand"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Parade mode"
              aria-label="Parade mode"
            >
              <Layers className="h-3 w-3" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          <span
            className={cn(
              "flex items-center gap-0.5 transition-colors",
              hasShadowClip ? "text-[#fda4af]" : "text-muted-foreground/50"
            )}
            title={clipping ? `${(clipping.shadowClipped * 100).toFixed(1)}% shadows clipped` : ""}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                hasShadowClip ? "animate-pulse bg-[#fda4af]" : "bg-muted-foreground/30"
              )}
            />
            S
          </span>
          <span className="flex items-center gap-0.5 text-red-400/80">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />R
          </span>
          <span className="flex items-center gap-0.5 text-green-400/80">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />G
          </span>
          <span className="flex items-center gap-0.5 text-sky-400/80">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />B
          </span>
          <span
            className={cn(
              "flex items-center gap-0.5 transition-colors",
              hasHighlightClip ? "text-[#fda4af]" : "text-muted-foreground/50"
            )}
            title={clipping ? `${(clipping.highlightClipped * 100).toFixed(1)}% highlights clipped` : ""}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                hasHighlightClip ? "animate-pulse bg-[#fda4af]" : "bg-muted-foreground/30"
              )}
            />
            H
          </span>
        </div>
      </div>

      {/* Graph */}
      {mode === "overlay" ? (
        <svg
          viewBox={`0 0 ${HIST_W} ${HIST_H}`}
          className="h-14 w-full"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="hist-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.06)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
            <pattern id="zebra" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="2" height="4" fill="rgba(253,164,175,0.35)" />
            </pattern>
          </defs>
          <rect x="0" y="0" width={HIST_W} height={HIST_H} fill="url(#hist-fade)" />
          {hasShadowClip ? (
            <rect x="0" y="0" width={clipWidth} height={HIST_H} fill="url(#zebra)" />
          ) : null}
          {hasHighlightClip ? (
            <rect x={highlightClipX} y="0" width={clipWidth} height={HIST_H} fill="url(#zebra)" />
          ) : null}
          <g style={{ mixBlendMode: "screen" }}>
            <path d={pathFor("r", HIST_H)} fill="none" stroke="rgba(248,113,113,0.9)" strokeWidth="1" />
            <path d={pathFor("g", HIST_H)} fill="none" stroke="rgba(74,222,128,0.9)" strokeWidth="1" />
            <path d={pathFor("b", HIST_H)} fill="none" stroke="rgba(56,189,248,0.9)" strokeWidth="1" />
          </g>
        </svg>
      ) : (
        <svg
          viewBox={`0 0 ${HIST_W} ${paradeHeight}`}
          className="w-full"
          style={{ height: paradeHeight }}
          preserveAspectRatio="none"
        >
          <defs>
            <pattern id="zebra-p" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="2" height="4" fill="rgba(253,164,175,0.35)" />
            </pattern>
          </defs>
          {/* R row */}
          <g transform={`translate(0, 0)`}>
            <rect x="0" y="0" width={HIST_W} height={PARADE_ROW_H} fill="rgba(248,113,113,0.04)" />
            {hasShadowClip ? <rect x="0" y="0" width={clipWidth} height={PARADE_ROW_H} fill="url(#zebra-p)" /> : null}
            {hasHighlightClip ? <rect x={highlightClipX} y="0" width={clipWidth} height={PARADE_ROW_H} fill="url(#zebra-p)" /> : null}
            <path d={pathFor("r", PARADE_ROW_H)} fill="rgba(248,113,113,0.15)" stroke="rgba(248,113,113,0.9)" strokeWidth="1" />
          </g>
          {/* G row */}
          <g transform={`translate(0, ${PARADE_ROW_H + 2})`}>
            <rect x="0" y="0" width={HIST_W} height={PARADE_ROW_H} fill="rgba(74,222,128,0.04)" />
            {hasShadowClip ? <rect x="0" y="0" width={clipWidth} height={PARADE_ROW_H} fill="url(#zebra-p)" /> : null}
            {hasHighlightClip ? <rect x={highlightClipX} y="0" width={clipWidth} height={PARADE_ROW_H} fill="url(#zebra-p)" /> : null}
            <path d={pathFor("g", PARADE_ROW_H)} fill="rgba(74,222,128,0.15)" stroke="rgba(74,222,128,0.9)" strokeWidth="1" />
          </g>
          {/* B row */}
          <g transform={`translate(0, ${(PARADE_ROW_H + 2) * 2})`}>
            <rect x="0" y="0" width={HIST_W} height={PARADE_ROW_H} fill="rgba(56,189,248,0.04)" />
            {hasShadowClip ? <rect x="0" y="0" width={clipWidth} height={PARADE_ROW_H} fill="url(#zebra-p)" /> : null}
            {hasHighlightClip ? <rect x={highlightClipX} y="0" width={clipWidth} height={PARADE_ROW_H} fill="url(#zebra-p)" /> : null}
            <path d={pathFor("b", PARADE_ROW_H)} fill="rgba(56,189,248,0.15)" stroke="rgba(56,189,248,0.9)" strokeWidth="1" />
          </g>
        </svg>
      )}

      {/* Clipping threshold slider */}
      <div className="mt-1.5 flex items-center gap-2">
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60">
          Clip
        </span>
        <input
          type="range"
          min={1}
          max={20}
          step={1}
          value={clipThreshold}
          onChange={(e) => setClipThreshold(parseInt(e.target.value))}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-muted"
          style={{ accentColor: "#E8A87C" }}
          aria-label="Clipping threshold"
        />
        <span className="font-mono text-[9px] tabular-nums text-amber-brand/70">
          {clipThreshold}
        </span>
      </div>
    </div>
  );
}
