"use client";

import type { ReactNode } from "react";
import { useEditorStore } from "@/store/editor-store";
import { PresetButtons } from "./PresetButtons";
import { LabeledSlider } from "./Slider";
import { ColorPicker } from "./ColorPicker";
import { Histogram } from "./Histogram";
import { cn } from "@/lib/utils";

function Section({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2 border-b border-border/60 pb-2">
        <span className="text-amber-brand/80">{icon}</span>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          {title}
        </h3>
      </div>
      <div className="space-y-3.5">{children}</div>
    </section>
  );
}

export function ControlPanel() {
  const hasImage = useEditorStore((s) => !!s.image);
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4 sm:px-5">
        <PresetButtons />
        {hasImage ? <Histogram /> : null}

        <Section title="Color" icon={<SwatchIcon />}>
          <LabeledSlider
            param="warmth"
            label="Warmth"
            description="Pushes white balance toward amber (~4000K)."
            format={(v) => v.toFixed(2)}
          />
          <ColorPicker param="highlightTint" label="Highlight Tint" />
          <ColorPicker param="shadowTint" label="Shadow Tint" />
          <LabeledSlider
            param="tintStrength"
            label="Tint Strength"
            description="How strongly highlight/shadow tints are blended."
            format={(v) => v.toFixed(2)}
          />
          <LabeledSlider
            param="saturation"
            label="Saturation"
            description="Luminance-preserving saturation boost."
            format={(v) => v.toFixed(2)}
          />
        </Section>

        <Section title="Tone" icon={<LevelsIcon />}>
          <LabeledSlider param="blackPoint" label="Black Point" />
          <LabeledSlider param="whitePoint" label="White Point" />
          <LabeledSlider
            param="gamma"
            label="Gamma"
            description="Midtone brightness. <1 brightens mids, >1 darkens."
            format={(v) => v.toFixed(2)}
          />
          <LabeledSlider
            param="vignette"
            label="Vignette"
            description="Radial corner darkening — heavier = moodier."
            format={(v) => v.toFixed(2)}
          />
        </Section>

        <Section title="Texture" icon={<GrainIcon />}>
          <LabeledSlider
            param="grain"
            label="Grain Amount"
            description="Silver-halide film grain intensity (std-dev)."
            format={(v) => v.toFixed(1)}
          />
          <LabeledSlider
            param="grainSize"
            label="Grain Size"
            description="Blur radius — larger = softer, finer grain."
            format={(v) => v.toFixed(2)}
          />
        </Section>

        <div className="pb-2 pt-1 text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground/50">
          Space — toggle before/after · ⌘Z — undo
        </div>
      </div>
    </div>
  );
}

/* --- Tiny inline icons (no extra deps) ------------------------------- */
function SwatchIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="9" />
      <circle cx="9" cy="9" r="2.5" />
    </svg>
  );
}
function LevelsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 18h18M3 12h18M3 6h18" />
      <circle cx="8" cy="18" r="2" fill="currentColor" />
      <circle cx="15" cy="12" r="2" fill="currentColor" />
      <circle cx="11" cy="6" r="2" fill="currentColor" />
    </svg>
  );
}
function GrainIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      {Array.from({ length: 18 }).map((_, i) => {
        const x = 3 + (i % 6) * 3.6 + ((i * 7) % 3);
        const y = 3 + Math.floor(i / 6) * 6 + ((i * 5) % 3);
        return <circle key={i} cx={x} cy={y} r={0.9 + ((i % 3) * 0.3)} />;
      })}
    </svg>
  );
}
