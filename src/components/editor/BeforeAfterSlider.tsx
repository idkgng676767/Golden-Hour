"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/store/editor-store";
import { ImageCanvas } from "./ImageCanvas";
import { cn } from "@/lib/utils";
import { MoveHorizontal } from "lucide-react";

/**
 * BeforeAfterSlider — drag-handle comparison between the original photo
 * (left of handle) and the graded preview (right of handle).
 *
 * - Pointer events for unified mouse + touch.
 * - No re-render of the canvas on drag — only the clip-path of the overlay
 *   <img> changes, so dragging feels 1:1 with the cursor.
 * - Handle is keyboard-accessible (Left/Right arrows).
 */
export function BeforeAfterSlider({ className }: { className?: string }) {
  const image = useEditorStore((s) => s.image);
  const sliderPos = useEditorStore((s) => s.sliderPos);
  const setSliderPos = useEditorStore((s) => s.setSliderPos);
  const isComparing = useEditorStore((s) => s.isComparing);
  const setComparing = useEditorStore((s) => s.setComparing);

  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const p = Math.max(0, Math.min(1, x / rect.width));
      setSliderPos(p);
    },
    [setSliderPos]
  );

  // Pointer drag handlers.
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      e.preventDefault();
      updateFromClientX(e.clientX);
    };
    const onUp = () => setDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging, updateFromClientX]);

  // Spacebar toggles before/after (whole-image flip).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) {
        const target = e.target as HTMLElement | null;
        // Don't hijack space when focused on a form control.
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        )
          return;
        e.preventDefault();
        setComparing(!isComparing);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isComparing, setComparing]);

  if (!image) return null;

  const pct = (sliderPos * 100).toFixed(2);

  return (
    <div
      ref={containerRef}
      className={cn(
        "group relative h-full w-full select-none overflow-hidden rounded-xl bg-checker",
        className
      )}
      onPointerDown={(e) => {
        // Click anywhere on the image to move the handle there + start dragging.
        setDragging(true);
        updateFromClientX(e.clientX);
      }}
    >
      {/* Graded canvas (right side, full) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <ImageCanvas className="max-h-full max-w-full" />
      </div>

      {/* Original image overlay — clipped to left of handle */}
      <div
        className="absolute inset-0 flex items-center justify-center transition-none"
        style={{
          clipPath:
            // When space-comparing, show full original; else clip to left.
            isComparing
              ? "inset(0 0 0 0)"
              : `inset(0 ${100 - parseFloat(pct)}% 0 0)`,
        }}
      >
        {/* Original photo — <img> is intentional here (local blob URL, no next/image optimization needed) */}
        <img
          src={image.url}
          alt="Original"
          draggable={false}
          className="max-h-full max-w-full object-contain pointer-events-none"
        />
      </div>

      {/* Labels */}
      <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80 backdrop-blur-sm">
        Before
      </div>
      <div className="pointer-events-none absolute right-3 top-3 rounded-md bg-amber-brand/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-black backdrop-blur-sm">
        After
      </div>

      {/* Drag handle */}
      <button
        type="button"
        aria-label="Before/after slider handle"
        aria-valuenow={parseFloat(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        role="slider"
        className="absolute top-0 bottom-0 z-10 flex w-1 cursor-ew-resize items-center justify-center bg-white shadow-[0_0_12px_rgba(0,0,0,0.6)] outline-none"
        style={{ left: `calc(${pct}% - 2px)` }}
        onPointerDown={(e) => {
          e.stopPropagation();
          setDragging(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            setSliderPos(Math.max(0, sliderPos - 0.02));
          } else if (e.key === "ArrowRight") {
            e.preventDefault();
            setSliderPos(Math.min(1, sliderPos + 0.02));
          }
        }}
      >
        <span className="grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-black/70 text-white backdrop-blur-sm transition-transform duration-100 hover:scale-110">
          <MoveHorizontal className="h-4 w-4" />
        </span>
      </button>
    </div>
  );
}
