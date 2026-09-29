"use client";

import { useEditorStore } from "@/store/editor-store";
import { cn } from "@/lib/utils";
import { RotateCcw, Power } from "lucide-react";
import { toast } from "sonner";

/**
 * SelectiveGradePanel — controls for the subject-isolation color grade.
 *
 * Applies a secondary grade to the subject (defined by a luminance band)
 * and a different grade to the background. Toggle on/off, adjust the
 * luminance band that defines the "subject", and tune subject/background
 * grade parameters independently.
 */
export function SelectiveGradePanel() {
  const selective = useEditorStore((s) => s.selective);
  const setSelectiveParam = useEditorStore((s) => s.setSelectiveParam);
  const resetSelective = useEditorStore((s) => s.resetSelective);

  return (
    <div className="space-y-3">
      {/* Enable toggle */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setSelectiveParam("enabled", !selective.enabled)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all active:scale-95",
            selective.enabled
              ? "border-amber-brand bg-amber-brand/15 text-amber-brand"
              : "border-border bg-surface text-muted-foreground hover:text-foreground"
          )}
        >
          <Power className="h-3 w-3" />
          {selective.enabled ? "Enabled" : "Disabled"}
        </button>
        <button
          type="button"
          onClick={() => {
            resetSelective();
            toast.success("Selective grade reset");
          }}
          title="Reset selective grade"
          aria-label="Reset selective grade"
          className="grid h-6 w-6 place-items-center rounded-md border border-border bg-surface text-muted-foreground transition-all hover:text-amber-brand active:scale-95"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      </div>

      {selective.enabled ? (
        <div className="space-y-3.5">
          {/* Subject luminance band */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">
              Subject Luminance Band
            </div>
            <DualRangeSlider
              low={selective.subjectLumaLow}
              high={selective.subjectLumaHigh}
              onChange={(low, high) => {
                setSelectiveParam("subjectLumaLow", low);
                setSelectiveParam("subjectLumaHigh", high);
              }}
            />
            <div className="flex justify-between font-mono text-[10px] text-muted-foreground/60">
              <span>Low: {selective.subjectLumaLow.toFixed(2)}</span>
              <span>High: {selective.subjectLumaHigh.toFixed(2)}</span>
            </div>
          </div>

          <SelectiveOverride
            label="Strength"
            value={selective.strength}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => setSelectiveParam("strength", v)}
          />

          {/* Subject grade */}
          <div className="space-y-2 rounded-md border border-amber-brand/15 bg-amber-brand/[0.03] p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-brand/80">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-brand" />
              Subject
            </div>
            <SelectiveOverride
              label="Warmth"
              value={selective.subjectWarmth}
              min={0}
              max={0.4}
              step={0.01}
              onChange={(v) => setSelectiveParam("subjectWarmth", v)}
            />
            <SelectiveOverride
              label="Saturation"
              value={selective.subjectSaturation}
              min={0.5}
              max={2}
              step={0.01}
              onChange={(v) => setSelectiveParam("subjectSaturation", v)}
            />
          </div>

          {/* Background grade */}
          <div className="space-y-2 rounded-md border border-teal-brand/20 bg-teal-brand/[0.03] p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#5b8fa3]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#5b8fa3]" />
              Background
            </div>
            <SelectiveOverride
              label="Darken"
              value={selective.bgDarken}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => setSelectiveParam("bgDarken", v)}
            />
            <SelectiveOverride
              label="Desaturate"
              value={selective.bgDesaturate}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => setSelectiveParam("bgDesaturate", v)}
            />
          </div>
        </div>
      ) : (
        <p className="text-[11px] leading-snug text-muted-foreground/70">
          Isolate the subject via a luminance band and grade it separately
          from the background — warm the subject, mute the background.
        </p>
      )}
    </div>
  );
}

/** A generic slider for selective params (not in PARAM_RANGES). */
function SelectiveOverride({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label className="text-[13px] font-medium text-foreground/90">
          {label}
        </label>
        <span className="font-mono text-[11px] tabular-nums text-amber-brand">
          {value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-amber-brand"
        style={{
          accentColor: "#E8A87C",
        }}
      />
    </div>
  );
}

/** Dual-thumb range slider for the luminance band. */
function DualRangeSlider({
  low,
  high,
  onChange,
}: {
  low: number;
  high: number;
  onChange: (low: number, high: number) => void;
}) {
  return (
    <div className="relative h-6 w-full">
      {/* Track */}
      <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-muted" />
      {/* Selected range */}
      <div
        className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-amber-brand"
        style={{
          left: `${low * 100}%`,
          width: `${(high - low) * 100}%`,
        }}
      />
      {/* Low thumb */}
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={low}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          onChange(Math.min(v, high - 0.05), high);
        }}
        className="pointer-events-auto absolute top-0 h-6 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-amber-brand [&::-webkit-slider-thumb]:bg-surface [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-amber-brand [&::-moz-range-thumb]:bg-surface"
        style={{ accentColor: "#E8A87C" }}
        aria-label="Subject luminance low"
      />
      {/* High thumb (offset z-index to be on top) */}
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={high}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          onChange(low, Math.max(v, low + 0.05));
        }}
        className="pointer-events-auto absolute top-0 z-10 h-6 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-amber-brand [&::-webkit-slider-thumb]:bg-surface [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-amber-brand [&::-moz-range-thumb]:bg-surface"
        style={{ accentColor: "#E8A87C" }}
        aria-label="Subject luminance high"
      />
    </div>
  );
}
