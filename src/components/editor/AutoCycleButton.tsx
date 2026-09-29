"use client";

import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/store/editor-store";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * AutoCycleButton — toggles an automatic before/after sweep animation.
 *
 * When active, the before/after slider position animates from 1.0 (full
 * graded) → 0.0 (full original) → 1.0 in a continuous ping-pong loop.
 * Great for demo reels and showing the grade transformation in action.
 *
 * The sweep takes ~3 seconds each direction (6s full cycle). Uses rAF
 * for smooth 60fps motion independent of the slider's drag logic.
 */
export function AutoCycleButton({ className }: { className?: string }) {
  const image = useEditorStore((s) => s.image);
  const setSliderPos = useEditorStore((s) => s.setSliderPos);
  const sliderPos = useEditorStore((s) => s.sliderPos);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const directionRef = useRef<-1 | 1>(-1);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!playing) return;
    startTimeRef.current = performance.now();
    directionRef.current = sliderPos > 0.5 ? -1 : 1;

    const loop = (now: number) => {
      const elapsed = (now - startTimeRef.current) / 1000;
      // 3 seconds per direction → full sweep = 6s.
      const speed = 1 / 3;
      let pos = sliderPos + directionRef.current * speed * (1 / 60); // fallback
      // Use elapsed for smoother timing.
      const start = directionRef.current === -1 ? 1 : 0;
      const target = directionRef.current === -1 ? 0 : 1;
      pos = start + (target - start) * Math.min(1, elapsed * speed);

      if (pos <= 0) {
        pos = 0;
        directionRef.current = 1;
        startTimeRef.current = now;
      } else if (pos >= 1) {
        pos = 1;
        directionRef.current = -1;
        startTimeRef.current = now;
      }
      setSliderPos(pos);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  // Stop playing if image is removed.
  useEffect(() => {
    if (!image && playing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlaying(false);
    }
  }, [image, playing]);

  if (!image) return null;

  return (
    <button
      type="button"
      onClick={() => setPlaying((p) => !p)}
      title={playing ? "Pause auto-cycle" : "Auto-cycle before/after"}
      aria-label={playing ? "Pause auto-cycle" : "Play auto-cycle"}
      aria-pressed={playing}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium transition-all active:scale-95",
        playing
          ? "border-amber-brand bg-amber-brand/15 text-amber-brand"
          : "border-border bg-surface text-muted-foreground hover:border-amber-brand/50 hover:text-amber-brand",
        className
      )}
    >
      {playing ? (
        <Pause className="h-3.5 w-3.5" />
      ) : (
        <Play className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">{playing ? "Pause" : "Cycle"}</span>
      {playing ? (
        <span className="ml-0.5 flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-1.5 w-1.5 animate-ping rounded-full bg-amber-brand opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-brand" />
        </span>
      ) : null}
    </button>
  );
}
