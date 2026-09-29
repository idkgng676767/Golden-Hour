"use client";

import { useEditorStore } from "@/store/editor-store";
import { Undo2, Redo2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * HistoryScrubber — tiny visual indicator of undo/redo depth.
 *
 * Renders a horizontal row of dots: amber-filled for past steps (undo-able),
 * dim for future steps (redo-able). Clicking a dot jumps to that history
 * state by calling undo/redo the appropriate number of times.
 */
export function HistoryScrubber() {
  const past = useEditorStore((s) => s.past);
  const future = useEditorStore((s) => s.future);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);

  const total = past.length + future.length;
  if (total === 0) return null;

  const maxDots = 12;
  // Show most-recent-first: past dots (undo-able) on the left, current
  // pointer in the middle, future dots (redo-able) on the right.
  const pastDots = Math.min(past.length, maxDots);
  const futureDots = Math.min(future.length, maxDots - pastDots);

  const jumpTo = (index: number) => {
    // index 0 = oldest past, past.length = current.
    // If user clicks a past dot, undo until we reach that state.
    // If they click a future dot, redo until we reach it.
    const targetPast = index;
    if (targetPast < past.length) {
      // Undo (past.length - targetPast) times.
      const steps = past.length - targetPast;
      for (let i = 0; i < steps; i++) undo();
    } else {
      const steps = targetPast - past.length;
      for (let i = 0; i < steps; i++) redo();
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-surface/40 px-2 py-1">
      <button
        type="button"
        onClick={undo}
        disabled={past.length === 0}
        aria-label="Undo"
        title="Undo (⌘Z)"
        className="grid h-5 w-5 place-items-center rounded text-muted-foreground transition-colors hover:text-amber-brand disabled:opacity-30"
      >
        <Undo2 className="h-3 w-3" />
      </button>
      <div className="flex items-center gap-0.5">
        {Array.from({ length: pastDots }).map((_, i) => {
          // Each dot represents a past state. The last one (index
          // pastDots-1) is the most recent undo-able state.
          const realIndex = past.length - pastDots + i;
          return (
            <button
              key={`p-${i}`}
              type="button"
              onClick={() => jumpTo(realIndex)}
              aria-label={`Jump to history step ${realIndex + 1}`}
              title={`Step ${realIndex + 1} (undo-able)`}
              className={cn(
                "h-1.5 w-1.5 rounded-full transition-all hover:scale-150",
                i === pastDots - 1
                  ? "bg-amber-brand"
                  : "bg-amber-brand/50 hover:bg-amber-brand/80"
              )}
            />
          );
        })}
        {/* Current state marker */}
        <span
          className="mx-0.5 h-2.5 w-2.5 rounded-full bg-foreground shadow-[0_0_6px_rgba(232,168,124,0.4)]"
          title="Current state"
        />
        {Array.from({ length: futureDots }).map((_, i) => (
          <button
            key={`f-${i}`}
            type="button"
            onClick={() => jumpTo(past.length + i + 1)}
            aria-label={`Jump forward to step ${past.length + i + 2}`}
            title={`Step ${past.length + i + 2} (redo-able)`}
            className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 transition-all hover:scale-150 hover:bg-muted-foreground/60"
          />
        ))}
      </div>
      <button
        type="button"
        onClick={redo}
        disabled={future.length === 0}
        aria-label="Redo"
        title="Redo (⌘⇧Z)"
        className="grid h-5 w-5 place-items-center rounded text-muted-foreground transition-colors hover:text-amber-brand disabled:opacity-30"
      >
        <Redo2 className="h-3 w-3" />
      </button>
      <span className="ml-1 font-mono text-[10px] tabular-nums text-muted-foreground/70">
        {past.length}/{past.length + future.length}
      </span>
    </div>
  );
}
