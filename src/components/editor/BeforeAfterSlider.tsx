"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/store/editor-store";
import { ImageCanvas } from "./ImageCanvas";
import { cn } from "@/lib/utils";
import { MoveHorizontal, SplitSquareHorizontal, Slash } from "lucide-react";

type HandleMode = "vertical" | "diagonal";

/**
 * BeforeAfterSlider — drag-handle comparison between the original photo
 * (left of handle) and the graded preview (right of handle).
 *
 * Two modes:
 *   - `vertical`  — classic vertical bar handle (left=original, right=graded)
 *   - `diagonal`  — Darkroom-style 45° diagonal split. The original occupies
 *     the bottom-left triangle, graded the top-right. Dragging moves the
 *     split line parallel to itself.
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
  const [mode, setMode] = useState<HandleMode>("vertical");

  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const updateFromClientX = useCallback(
    (clientX: number, clientY?: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = (clientY ?? rect.top + rect.height / 2) - rect.top;
      let p: number;
      if (mode === "diagonal") {
        // For diagonal mode, project the cursor onto the diagonal axis.
        // The diagonal runs from bottom-left (0) to top-right (1).
        // We use the sum (x/W + (1 - y/H)) / 2 normalized to 0..1.
        const nx = x / rect.width;
        const ny = y / rect.height;
        p = (nx + (1 - ny)) / 2;
      } else {
        p = x / rect.width;
      }
      setSliderPos(Math.max(0, Math.min(1, p)));
    },
    [mode, setSliderPos]
  );

  // Pointer drag handlers.
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      e.preventDefault();
      updateFromClientX(e.clientX, e.clientY);
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

  // Cycle handle mode with `V` key.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "v") {
        const target = e.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.isContentEditable)
        )
          return;
        setMode((m) => (m === "vertical" ? "diagonal" : "vertical"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!image) return null;

  const pct = (sliderPos * 100).toFixed(2);

  // Build the clip-path for the original-image overlay.
  // Vertical: left strip [0, pct%] of width.
  // Diagonal: bottom-left triangle — a polygon whose top-right corner slides
  //   along the diagonal as `pct` goes 0→1.
  let clipPath: string;
  if (isComparing) {
    clipPath = "inset(0 0 0 0)";
  } else if (mode === "vertical") {
    clipPath = `inset(0 ${100 - parseFloat(pct)}% 0 0)`;
  } else {
    // Diagonal polygon: bottom-left triangle.
    // Vertices: (0,0) top-left, (pct%, 0) along top edge,
    //           (0, pct%) along left edge — wait, that's not the diagonal.
    // The diagonal split line goes from (pct%·W, 0) at top to (0, (1-pct%)·H)
    // at left. Original (bottom-left) = polygon [(0, (1-pct)·H), (pct·W, 0)?...]
    // Actually: original is BELOW-LEFT of the diagonal.
    // Polygon points (in %): top-left of original region =
    //   (0, (100-pct)%) → (pct%, 0%) is the diagonal start... let me think.
    // Diagonal line from (pct%, 0) [top edge] to (0, (100-pct)%) [left edge].
    // Below-left of that line = the original region.
    // Polygon: (0, (100-pct)%) → (0, 100%) → (100%, 100%) → (100%, 0%) → (pct%, 0%)
    const p = parseFloat(pct);
    clipPath = `polygon(0% ${100 - p}%, 0% 100%, 100% 100%, 100% 0%, ${p}% 0%)`;
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "group relative h-full w-full select-none overflow-hidden rounded-xl bg-checker",
        className
      )}
      onPointerDown={(e) => {
        setDragging(true);
        updateFromClientX(e.clientX, e.clientY);
      }}
    >
      {/* Graded canvas (full) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <ImageCanvas className="max-h-full max-w-full" />
      </div>

      {/* Original image overlay — clipped */}
      <div
        className="absolute inset-0 flex items-center justify-center transition-none"
        style={{ clipPath }}
      >
        <img
          src={image.url}
          alt="Original"
          draggable={false}
          className="max-h-full max-w-full object-contain pointer-events-none"
        />
      </div>

      {/* Labels */}
      <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80 backdrop-blur-sm">
        Before
      </div>
      <div className="pointer-events-none absolute right-3 bottom-3 z-20 rounded-md bg-amber-brand/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-black backdrop-blur-sm">
        After
      </div>

      {/* Mode toggle — small floating control, top-right */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setMode((m) => (m === "vertical" ? "diagonal" : "vertical"));
        }}
        title={`Switch to ${mode === "vertical" ? "diagonal" : "vertical"} split (V)`}
        aria-label={`Switch to ${mode === "vertical" ? "diagonal" : "vertical"} split`}
        className="absolute right-3 top-3 z-20 grid h-8 w-8 place-items-center rounded-lg border border-border bg-black/60 text-white/80 backdrop-blur-sm transition-all hover:text-amber-brand active:scale-95"
      >
        {mode === "vertical" ? (
          <Slash className="h-4 w-4" />
        ) : (
          <SplitSquareHorizontal className="h-4 w-4" />
        )}
      </button>

      {/* Drag handle */}
      {mode === "vertical" ? (
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
      ) : (
        <DiagonalHandle pct={parseFloat(pct)} onPointerDown={() => setDragging(true)} />
      )}
    </div>
  );
}

/** Diagonal split handle — a rotated white bar along the 45° diagonal. */
function DiagonalHandle({
  pct,
  onPointerDown,
}: {
  pct: number;
  onPointerDown: () => void;
}) {
  // The diagonal line runs from (pct%, 0) [top] to (0, (100-pct)%) [left].
  // The handle sits at the midpoint of that line, rotated 45°.
  const midX = pct / 2;
  const midY = (100 - pct) / 2;
  return (
    <button
      type="button"
      aria-label="Diagonal before/after handle"
      role="slider"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      onPointerDown={(e) => {
        e.stopPropagation();
        onPointerDown();
      }}
      className="absolute z-10 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-black/70 text-white shadow-[0_0_12px_rgba(0,0,0,0.6)] backdrop-blur-sm transition-transform duration-100 hover:scale-110"
      style={{
        left: `${midX}%`,
        top: `${midY}%`,
        cursor: "grab",
      }}
    >
      <span className="rotate-45">
        <MoveHorizontal className="h-4 w-4" />
      </span>
    </button>
  );
}
