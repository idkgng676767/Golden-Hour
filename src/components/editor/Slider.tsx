"use client";

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
 * Slider — labeled parameter slider with a monospace value readout.
 *
 * On commit (pointer up / keyboard release) we push the previous value onto
 * the undo stack so Cmd+Z restores it.
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

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[13px] font-medium text-foreground/90">
          {label}
        </label>
        <span className="font-mono text-[11px] tabular-nums text-amber-brand">
          {display}
        </span>
      </div>
      <UISlider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => setParam(param, v[0] as never)}
        onPointerDown={() => commit()}
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
