"use client";

import { useEffect } from "react";
import { useEditorStore } from "@/store/editor-store";
import { X } from "lucide-react";

const SHORTCUTS: { keys: string[]; label: string; hint?: string }[] = [
  { keys: ["Space"], label: "Toggle before/after", hint: "Hold to compare" },
  { keys: ["V"], label: "Cycle split mode", hint: "Vertical ↔ diagonal" },
  { keys: ["J"], label: "Previous custom preset", hint: "Film contact-sheet" },
  { keys: ["K"], label: "Next custom preset" },
  { keys: ["R"], label: "Rotate image 90° clockwise" },
  { keys: ["C"], label: "Open preset comparison" },
  { keys: ["⌘/Ctrl", "Z"], label: "Undo last change" },
  { keys: ["⌘/Ctrl", "Shift", "Z"], label: "Redo (or ⌘+Y)" },
  { keys: ["⌘/Ctrl", "S"], label: "Download graded image" },
  { keys: ["⌘/Ctrl", "C"], label: "Copy shareable link" },
  { keys: ["?"], label: "Toggle this help" },
  { keys: ["Esc"], label: "Close dialog / overlay" },
];

/** KeyboardHelpDialog — overlay shown when pressing `?` or clicking the Help button. */
export function KeyboardHelpDialog() {
  const open = useEditorStore((s) => s.helpOpen);
  const setOpen = useEditorStore((s) => s.setHelpOpen);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
          <div>
            <h2 className="font-serif text-lg font-semibold text-foreground">
              Shortcuts
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Move like a darkroom pro.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface-elevated text-muted-foreground transition-all hover:text-foreground active:scale-95"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* List */}
        <ul className="divide-y divide-border/40">
          {SHORTCUTS.map((s) => (
            <li
              key={s.label}
              className="flex items-center justify-between gap-3 px-5 py-2.5"
            >
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-foreground">
                  {s.label}
                </div>
                {s.hint ? (
                  <div className="text-[11px] text-muted-foreground">
                    {s.hint}
                  </div>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {s.keys.map((k, i) => (
                  <kbd
                    key={i}
                    className="rounded-md border border-border bg-surface-elevated px-1.5 py-0.5 font-mono text-[10px] font-semibold text-amber-brand shadow-[0_1px_0_0_rgba(0,0,0,0.4)]"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <div className="border-t border-border/60 px-5 py-3 text-center text-[10px] uppercase tracking-[0.18em] text-muted-foreground/60">
          Press <span className="text-amber-brand">?</span> anywhere to open this again
        </div>
      </div>
    </div>
  );
}
