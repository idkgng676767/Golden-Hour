"use client";

import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/store/editor-store";
import type { GradeRenderer } from "@/lib/grade/renderer";

const BINS = 32;
const W = 120;
const H = 36;

/** Build a compact 3-channel histogram from raw RGBA pixels. */
function buildMiniHistogram(data: Uint8Array) {
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
 * PreviewHistogram — a tiny inline RGB histogram overlaid on the image
 * preview's bottom-left corner (Lightroom-style CL/WS indicator).
 *
 * Reads from the live WebGL canvas via the shared renderer getter, same as
 * the main Histogram but smaller and always-visible during editing.
 */
export function PreviewHistogram() {
  const image = useEditorStore((s) => s.image);
  const params = useEditorStore((s) => s.params);
  const curves = useEditorStore((s) => s.curves);
  const rotation = useEditorStore((s) => s.rotation);
  const rendererGetter = useEditorStore((s) => s.rendererGetter);
  const [hist, setHist] = useState<{ r: number[]; g: number[]; b: number[] } | null>(null);
  const rafRef = useRef<number | null>(null);

  // Poll the renderer for fresh pixels every ~600ms while an image is loaded.
  // (Cheaper than re-reading on every param change — the main Histogram
  // already does that. This is a passive indicator.)
  useEffect(() => {
    if (!image) return;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const renderer = rendererGetter?.() as GradeRenderer | null;
      if (renderer && typeof (renderer as GradeRenderer).readDownscaledPixels === "function") {
        try {
          const pixels = renderer.readDownscaledPixels(48);
          if (pixels && pixels.length > 0) {
            setHist(buildMiniHistogram(pixels));
          }
        } catch (e) {
          // readPixels can fail if the context is lost; ignore.
        }
      }
      rafRef.current = window.setTimeout(tick, 600) as unknown as number;
    };
    // Delay first tick to give the renderer time to initialize + draw.
    rafRef.current = window.setTimeout(tick, 800) as unknown as number;
    return () => {
      cancelled = true;
      if (rafRef.current !== null) clearTimeout(rafRef.current);
    };
  }, [image, rendererGetter]);

  // Clear histogram when image is removed.
  useEffect(() => {
    if (!image) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHist(null);
    }
  }, [image]);

  // Also refresh immediately on param/curve change.
  useEffect(() => {
    if (!image) return;
    const t = setTimeout(() => {
      const renderer = rendererGetter?.() as GradeRenderer | null;
      if (renderer && (renderer as GradeRenderer).readDownscaledPixels) {
        const pixels = renderer.readDownscaledPixels(48);
        if (pixels) {
          const built = buildMiniHistogram(pixels);
          // Defer to avoid setState-in-effect lint; safe inside setTimeout.
          Promise.resolve().then(() => setHist(built));
        }
      }
    }, 150);
    return () => clearTimeout(t);
  }, [params, curves, rotation, image, rendererGetter]);

  if (!hist) return null;

  const max = Math.max(...hist.r, ...hist.g, ...hist.b, 1);
  const binW = W / BINS;

  const pathFor = (ch: "r" | "g" | "b", color: string) => {
    const arr = hist[ch];
    let d = "";
    arr.forEach((v, i) => {
      const x = i * binW + binW / 2;
      const y = H - (v / max) * (H - 2) - 1;
      d += i === 0 ? `M${x.toFixed(1)},${y.toFixed(1)}` : ` L${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return (
      <path
        key={ch}
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="0.75"
        vectorEffect="non-scaling-stroke"
      />
    );
  };

  return (
    <div
      className="pointer-events-none absolute bottom-3 left-3 z-20 rounded-md border border-white/10 bg-black/60 px-1.5 py-1 backdrop-blur-md"
      title="Live RGB histogram"
      aria-hidden
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-9 w-[120px]"
        preserveAspectRatio="none"
        style={{ mixBlendMode: "screen" }}
      >
        {pathFor("r", "rgba(248,113,113,0.85)")}
        {pathFor("g", "rgba(74,222,128,0.85)")}
        {pathFor("b", "rgba(56,189,248,0.85)")}
      </svg>
    </div>
  );
}
