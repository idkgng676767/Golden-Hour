"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/store/editor-store";
import { cn } from "@/lib/utils";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  CURVE_X,
  buildLUT,
  type CurveChannel,
} from "@/lib/grade/curve";

type ChannelKey = "master" | "r" | "g" | "b";

const CHANNEL_META: Record<
  ChannelKey,
  { label: string; color: string; shortColor: string }
> = {
  master: { label: "RGB", color: "#fafafa", shortColor: "#fafafa" },
  r: { label: "Red", color: "#f87171", shortColor: "#ef4444" },
  g: { label: "Green", color: "#4ade80", shortColor: "#22c55e" },
  b: { label: "Blue", color: "#38bdf8", shortColor: "#0ea5e9" },
};

const CANVAS_SIZE = 220;

/**
 * CurveEditor — a Lightroom-style tone curve editor.
 *
 * Interactive SVG curve with draggable control points. The user picks a
 * channel (RGB master, R, G, B) and drags the interior points to remap
 * tonal values. Endpoints (0,0) and (255,255) are locked.
 *
 * The curve is sampled to a 256-entry LUT and uploaded as a 1D texture
 * to the WebGL shader (see ImageCanvas → renderer.updateCurves).
 */
export function CurveEditor() {
  const curves = useEditorStore((s) => s.curves);
  const activeChannel = useEditorStore((s) => s.activeCurveChannel);
  const setActiveChannel = useEditorStore((s) => s.setActiveCurveChannel);
  const setCurvePoint = useEditorStore((s) => s.setCurvePoint);
  const resetCurves = useEditorStore((s) => s.resetCurves);

  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  const channel: CurveChannel = curves[activeChannel];
  const meta = CHANNEL_META[activeChannel];

  // Convert a control-point (index) to SVG x coordinate.
  const xFor = (idx: number) => (CURVE_X[idx] / 255) * CANVAS_SIZE;
  // Convert a y value (0..1) to SVG y coordinate (flipped, 0 at bottom).
  const yFor = (y: number) => CANVAS_SIZE - y * CANVAS_SIZE;

  // Build the smooth curve path string for display.
  const curvePath = useCallback(() => {
    const pts = channel.points;
    const segments: string[] = [];
    for (let seg = 0; seg < 4; seg++) {
      const p0 = seg > 0 ? pts[seg - 1] : pts[seg];
      const p1 = pts[seg];
      const p2 = pts[seg + 1];
      const p3 = seg < 3 ? pts[seg + 2] : pts[seg + 1];
      const segStart = CURVE_X[seg];
      const segEnd = CURVE_X[seg + 1];
      const segLen = segEnd - segStart;
      const steps = 16;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const t2 = t * t;
        const t3 = t2 * t;
        const v =
          0.5 *
          (2 * p1 +
            (-p0 + p2) * t +
            (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
            (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
        const yClamped = Math.max(0, Math.min(1, v));
        const x = segStart + (segLen * i) / steps;
        const px = (x / 255) * CANVAS_SIZE;
        const py = CANVAS_SIZE - yClamped * CANVAS_SIZE;
        segments.push(`${i === 0 && seg === 0 ? "M" : "L"}${px.toFixed(1)},${py.toFixed(1)}`);
      }
    }
    return segments.join(" ");
  }, [channel.points]);

  // Handle pointer drag on a control point.
  useEffect(() => {
    if (draggingIdx === null) return;
    const onMove = (e: PointerEvent) => {
      e.preventDefault();
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const y = 1 - (e.clientY - rect.top) / rect.height;
      setCurvePoint(activeChannel, draggingIdx, y);
    };
    const onUp = () => setDraggingIdx(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [draggingIdx, activeChannel, setCurvePoint]);

  return (
    <div className="space-y-2.5">
      {/* Channel tabs */}
      <div className="flex items-center gap-1">
        {(Object.keys(CHANNEL_META) as ChannelKey[]).map((key) => {
          const m = CHANNEL_META[key];
          const isActive = activeChannel === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveChannel(key)}
              className={cn(
                "flex-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-all active:scale-95",
                isActive
                  ? "border-border bg-surface-elevated"
                  : "border-transparent bg-transparent text-muted-foreground hover:text-foreground"
              )}
              style={
                isActive
                  ? { color: m.color, boxShadow: `inset 0 0 0 1px ${m.color}44` }
                  : undefined
              }
            >
              {m.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            resetCurves();
            toast.success("Curves reset to linear");
          }}
          title="Reset curves"
          aria-label="Reset curves"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border bg-surface text-muted-foreground transition-all hover:text-amber-brand active:scale-95"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* The curve canvas */}
      <div className="relative rounded-lg border border-border bg-surface/60 p-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`}
          className="block h-auto w-full"
          style={{ aspectRatio: "1 / 1" }}
        >
          {/* Grid */}
          <defs>
            <pattern id="curve-grid" width="25%" height="25%" patternUnits="userSpaceOnUse">
              <path d="M 0 0 L 0 0 0 55" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width={CANVAS_SIZE} height={CANVAS_SIZE} fill="url(#curve-grid)" />

          {/* Diagonal reference line */}
          <line
            x1="0" y1={CANVAS_SIZE} x2={CANVAS_SIZE} y2="0"
            stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="2 3"
          />

          {/* The curve */}
          <path
            d={curvePath()}
            fill="none"
            stroke={meta.color}
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Control points */}
          {channel.points.map((p, i) => {
            const cx = xFor(i);
            const cy = yFor(p);
            const isLocked = i === 0 || i === 4;
            return (
              <g key={i}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={draggingIdx === i ? 7 : 5}
                  fill={isLocked ? "#27272a" : meta.color}
                  stroke={meta.color}
                  strokeWidth="1.5"
                  className={cn(
                    "transition-all",
                    !isLocked && "cursor-grab",
                    draggingIdx === i && "cursor-grabbing"
                  )}
                  style={{ filter: draggingIdx === i ? `drop-shadow(0 0 6px ${meta.color})` : undefined }}
                  onPointerDown={(e) => {
                    if (isLocked) return;
                    e.preventDefault();
                    setDraggingIdx(i);
                  }}
                />
              </g>
            );
          })}
        </svg>

        {/* Curve stats overlay */}
        <div className="pointer-events-none absolute bottom-1.5 right-2 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/60">
          {meta.label} · {channel.points[1].toFixed(2)}/{channel.points[2].toFixed(2)}/{channel.points[3].toFixed(2)}
        </div>
      </div>

      {/* Hint */}
      <p className="px-1 text-[11px] leading-snug text-muted-foreground/70">
        Drag the dots to remap shadows / mids / highlights. Endpoints are
        locked. Master applies to all channels; R/G/B are per-channel.
      </p>
    </div>
  );
}
