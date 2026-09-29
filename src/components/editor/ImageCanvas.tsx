"use client";

import { useEffect, useRef } from "react";
import { GradeRenderer } from "@/lib/grade/renderer";
import { useEditorStore } from "@/store/editor-store";
import { cn } from "@/lib/utils";

interface ImageCanvasProps {
  className?: string;
  /** Exposed so parent can read the renderer for export. */
  rendererRef?: React.MutableRefObject<GradeRenderer | null>;
}

/**
 * ImageCanvas — the WebGL canvas that renders the graded image.
 *
 * Owns its own rAF loop so grain shimmers continuously. Reads params from
 * the Zustand store so every slider change is reflected on the next frame
 * (well within the 50ms budget — a single draw call is sub-millisecond).
 */
export function ImageCanvas({ className, rendererRef }: ImageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderer = useRef<GradeRenderer | null>(null);

  const image = useEditorStore((s) => s.image);
  const params = useEditorStore((s) => s.params);
  const rotation = useEditorStore((s) => s.rotation);
  const curves = useEditorStore((s) => s.curves);
  const selective = useEditorStore((s) => s.selective);
  const setRendererGetter = useEditorStore((s) => s.setRendererGetter);

  // Expose renderer to parent + store (for Histogram readPixels).
  useEffect(() => {
    if (rendererRef) rendererRef.current = renderer.current;
    setRendererGetter(() => renderer.current);
    return () => {
      setRendererGetter(null);
      if (rendererRef) rendererRef.current = null;
    };
  }, [rendererRef, setRendererGetter]);

  // Initialise renderer once.
  useEffect(() => {
    if (!canvasRef.current) return;
    try {
      renderer.current = new GradeRenderer(canvasRef.current);
      if (rendererRef) rendererRef.current = renderer.current;
      setRendererGetter(() => renderer.current);
    } catch (err) {
      console.warn("[GoldenHour] WebGL unavailable, will use CPU fallback", err);
      renderer.current = null;
    }
    return () => {
      renderer.current?.dispose();
      renderer.current = null;
    };
  }, [rendererRef, setRendererGetter]);

  // Load image into renderer whenever it OR rotation changes.
  useEffect(() => {
    const r = renderer.current;
    if (!r || !image) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      r.setImage(img, undefined, rotation);
      const { w, h } = r.dims;
      r.resizeCanvas(w, h, Math.min(window.devicePixelRatio || 1, 2));
      r.draw(
        useEditorStore.getState().params,
        performance.now() / 1000,
        false
      );
    };
    img.src = image.url;
  }, [image, rotation]);

  // Start the animation loop once we have a renderer + image.
  useEffect(() => {
    const r = renderer.current;
    if (!r || !image) return;
    r.startAnimation(
      () => useEditorStore.getState().params,
      () => false,
      () => useEditorStore.getState().selective
    );
    return () => r.stopAnimation();
  }, [image]);

  // Re-draw immediately on param change (don't wait for next rAF frame).
  // The animation loop will also pick it up, but this keeps latency to 0.
  useEffect(() => {
    const r = renderer.current;
    if (!r || !image) return;
    r.draw(params, performance.now() / 1000, false, selective);
  }, [params, image, selective]);

  // Update the curve LUT texture when curves change.
  useEffect(() => {
    const r = renderer.current;
    if (!r) return;
    r.updateCurves(curves);
    // Force a redraw so the change is visible immediately.
    if (image)
      r.draw(
        useEditorStore.getState().params,
        performance.now() / 1000,
        false,
        useEditorStore.getState().selective
      );
  }, [curves, image]);

  return (
    <canvas
      ref={canvasRef}
      className={cn("block h-full w-full object-contain", className)}
      aria-label="Graded image preview"
    />
  );
}
