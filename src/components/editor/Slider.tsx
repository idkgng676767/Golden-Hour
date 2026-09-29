"use client";

import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/store/editor-store";
import { PARAM_RANGES, type RangedParam } from "@/lib/grade/defaults";
import { Slider as UISlider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface SliderProps {
  param: RangedParam;
  label: string;
  description?: string;
  /** Format the numeric value for display. */
  format?: (v: number) => string;
  className?: string;
}

/**
 * LabeledSlider — labeled parameter slider with a monospace value readout
 * and a floating value tooltip that appears above the thumb while dragging.
 *
 * On commit (pointer down) we push the previous value onto the undo stack
 * so Cmd+Z restores it.
 *
 * The tooltip position is computed from the value's fraction of the range,
 * so it tracks the thumb horizontally as the user drags.
 */
export function LabeledSlider({
  param,
  label,
  description,
  format,
  className,
}: SliderProps) {
  const value = useEditorStore((s) => s.params[param]);
  const setParam = useEditorStore((s) => s.setParam);
  const commit = useEditorStore((s) => s.commit);

  const { min, max, step } = PARAM_RANGES[param];
  const display = format ? format(value) : String(value);

  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Clear dragging on global pointerup (covers release-outside cases).
  useEffect(() => {
    if (!dragging) return;
    const onUp = () => setDragging(false);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [dragging]);

  // Compute the thumb's horizontal position as a percentage of the track.
  const thumbPct = ((value - min) / (max - min)) * 100;

  // Show the tooltip when dragging OR hovering.
  const showTooltip = dragging || hovered;

  return (
    <div
      ref={containerRef}
      className={cn("group relative space-y-1.5", className)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[13px] font-medium text-foreground/90">
          {label}
        </label>
        <span
          className={cn(
            "font-mono text-[11px] tabular-nums transition-colors",
            dragging ? "text-amber-brand" : "text-amber-brand/90"
          )}
        >
          {display}
        </span>
      </div>

      {/* Floating value tooltip — appears above the thumb while dragging/hovering */}
      {showTooltip ? (
        <div
          className="pointer-events-none absolute -top-6 z-20 -translate-x-1/2 transition-opacity duration-150"
          style={{
            left: `${thumbPct}%`,
            opacity: dragging ? 1 : 0.7,
          }}
        >
          <div
            className={cn(
              "whitespace-nowrap rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums shadow-lg",
              dragging
                ? "bg-amber-brand text-amber-foreground"
                : "bg-surface-elevated text-amber-brand"
            )}
          >
            {display}
          </div>
          {/* Tooltip tail */}
          <div
            className={cn(
              "mx-auto h-1.5 w-1.5 -mt-0.5 rotate-45",
              dragging ? "bg-amber-brand" : "bg-surface-elevated"
            )}
          />
        </div>
      ) : null}

      <UISlider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => setParam(param, v[0] as never)}
        onPointerDown={() => {
          commit();
          setDragging(true);
        }}
        onPointerUp={() => setDragging(false)}
        className="py-1"
      />
      {description ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}
