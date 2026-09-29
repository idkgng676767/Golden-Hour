"use client";

import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/store/editor-store";
import type { Histogram } from "@/lib/grade/types";
import { gradeImageData } from "@/lib/grade/cpu";

const BINS = 64;
const HIST_W = 240;
const HIST_H = 56;

/** Build a histogram from an ImageData (post-grade). */
function buildHistogram(data: Uint8ClampedArray): Histogram {
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

/** Downscale an image to ~96px longest side for fast histogram computation. */
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

/**
 * Histogram — live RGB histogram of the graded preview.
 *
 * Recomputes on every param change with a 120ms debounce. Uses a tiny
 * (96px) CPU-graded copy so it stays decoupled from the WebGL canvas and
 * never blocks the live preview.
 */
export function Histogram() {
  const image = useEditorStore((s) => s.image);
  const params = useEditorStore((s) => s.params);
  const [hist, setHist] = useState<Histogram | null>(null);
  const originalRef = useRef<ImageData | null>(null);

  // Re-decode the small original when the image changes.
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

  // Recompute the histogram (debounced) on param change.
  useEffect(() => {
    if (!originalRef.current) return;
    const t = setTimeout(() => {
      const graded = gradeImageData(originalRef.current!, params);
      setHist(buildHistogram(graded.data));
    }, 120);
    return () => clearTimeout(t);
  }, [params, image]);

  if (!hist) return null;

  const maxVal = Math.max(
    ...hist.r,
    ...hist.g,
    ...hist.b,
    1
  );
  const binW = HIST_W / BINS;

  const pathFor = (channel: "r" | "g" | "b") => {
    const arr = hist[channel];
    // Smooth: take max of neighbors for a less spiky curve.
    const smoothed = arr.map((v, i) => {
      const a = arr[Math.max(0, i - 1)] || 0;
      const b = arr[Math.min(arr.length - 1, i + 1)] || 0;
      return Math.max(v, a * 0.5, b * 0.5);
    });
    const m = Math.max(...smoothed, 1);
    let d = "";
    smoothed.forEach((v, i) => {
      const x = i * binW + binW / 2;
      const y = HIST_H - (v / m) * (HIST_H - 4) - 2;
      d += i === 0 ? `M${x.toFixed(2)},${y.toFixed(2)}` : ` L${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return d;
  };

  return (
    <div className="rounded-lg border border-border bg-surface/60 p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Histogram
        </span>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="flex items-center gap-1 text-red-400/80">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />R
          </span>
          <span className="flex items-center gap-1 text-green-400/80">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />G
          </span>
          <span className="flex items-center gap-1 text-sky-400/80">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />B
          </span>
        </div>
      </div>
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
        </defs>
        <rect x="0" y="0" width={HIST_W} height={HIST_H} fill="url(#hist-fade)" />
        {/* Channel paths with screen blend so overlaps read as combined color */}
        <g style={{ mixBlendMode: "screen" }}>
          <path d={pathFor("r")} fill="none" stroke="rgba(248,113,113,0.9)" strokeWidth="1" />
          <path d={pathFor("g")} fill="none" stroke="rgba(74,222,128,0.9)" strokeWidth="1" />
          <path d={pathFor("b")} fill="none" stroke="rgba(56,189,248,0.9)" strokeWidth="1" />
        </g>
      </svg>
    </div>
  );
}
