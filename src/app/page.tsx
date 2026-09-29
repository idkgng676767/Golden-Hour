"use client";

import { useEffect } from "react";
import { useEditorStore } from "@/store/editor-store";
import { useGlobalDragDrop, UploadZone } from "@/components/editor/UploadZone";
import { EmptyState } from "@/components/editor/EmptyState";
import { BeforeAfterSlider } from "@/components/editor/BeforeAfterSlider";
import { ControlPanel } from "@/components/editor/ControlPanel";
import { DownloadButton } from "@/components/editor/DownloadButton";
import { cn } from "@/lib/utils";
import { Sun, Undo2, Redo2, Upload, Sparkles } from "lucide-react";

export default function Home() {
  const image = useEditorStore((s) => s.image);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const past = useEditorStore((s) => s.past);
  const future = useEditorStore((s) => s.future);
  const applyPreset = useEditorStore((s) => s.applyPreset);
  const hydrateFromStorage = useEditorStore((s) => s.hydrateFromStorage);
  const isDragging = useGlobalDragDrop();

  // Hydrate persisted params on mount.
  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  // Global keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      // Cmd/Ctrl+Z — undo (Cmd+Shift+Z — redo on mac).
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      // Cmd/Ctrl+Shift+Z fallback redo (windows)
      else if (meta && e.shiftKey && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      }
      // Cmd/Ctrl+S — download
      else if (meta && e.key.toLowerCase() === "s") {
        e.preventDefault();
        const btn = document.querySelector<HTMLButtonElement>(
          "[data-download-trigger]"
        );
        btn?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* ---- Top bar ---- */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-amber-brand/30 bg-amber-brand/5 text-amber-brand">
            <Sun className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-serif text-lg font-semibold leading-tight text-foreground sm:text-xl">
              Golden Hour
            </h1>
            <p className="truncate text-[11px] text-muted-foreground">
              Vintage film color grade
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <UploadZone className="!py-1.5">
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Upload</span>
          </UploadZone>
          <button
            type="button"
            onClick={undo}
            disabled={past.length === 0}
            aria-label="Undo"
            className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface text-muted-foreground transition-all hover:text-foreground active:scale-95 disabled:opacity-30"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={future.length === 0}
            aria-label="Redo"
            className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface text-muted-foreground transition-all hover:text-foreground active:scale-95 disabled:opacity-30"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          {image ? (
            <span data-download-trigger className="contents">
              <DownloadButton />
            </span>
          ) : null}
        </div>
      </header>

      {/* ---- Main layout ---- */}
      <main className="flex flex-1 flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:gap-4">
        {/* Left: image preview (65% on desktop) */}
        <div className="relative flex min-h-[55vh] flex-1 items-center justify-center overflow-hidden rounded-xl border border-border bg-surface lg:min-h-0 lg:basis-[65%]">
          {image ? (
            <BeforeAfterSlider className="h-full max-h-[calc(100vh-7rem)] w-full" />
          ) : (
            <EmptyState />
          )}
        </div>

        {/* Right: control panel (35% on desktop) */}
        <aside className="flex shrink-0 flex-col rounded-xl border border-border bg-surface/40 lg:basis-[35%] lg:w-[380px]">
          {/* Panel header — hidden on mobile (the section headers speak for themselves) */}
          <div className="hidden items-center justify-between border-b border-border/60 px-5 py-3 sm:flex">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-amber-brand" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Develop
              </span>
            </div>
            <button
              type="button"
              onClick={() => applyPreset("reset")}
              className="text-[11px] font-medium text-muted-foreground underline-offset-4 hover:text-amber-brand hover:underline"
            >
              Reset all
            </button>
          </div>
          <ControlPanel />
        </aside>
      </main>

      {/* ---- Footer ---- */}
      <footer className="mt-auto border-t border-border/60 bg-background/60 px-4 py-3 text-center text-[11px] text-muted-foreground/70 sm:px-6">
        <span className="inline-flex items-center gap-1.5">
          Built with <span className="text-amber-brand">♥</span> · WebGL golden-hour grade ·
          grain, gamma &amp; teal shadows tuned to vintage 35mm film
        </span>
      </footer>

      {/* ---- Global drag-and-drop overlay ---- */}
      <div
        className={cn(
          "pointer-events-none fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-200",
          isDragging ? "opacity-100" : "opacity-0"
        )}
      >
        <div className="absolute inset-4 rounded-2xl border-2 border-dashed border-amber-brand bg-amber-brand/5 backdrop-blur-[2px]" />
        <div className="relative rounded-2xl border border-amber-brand/40 bg-background/90 px-8 py-6 text-center shadow-2xl">
          <Sun className="mx-auto mb-2 h-8 w-8 text-amber-brand" strokeWidth={1.5} />
          <p className="font-serif text-xl font-semibold">Drop to develop</p>
          <p className="mt-1 text-xs text-muted-foreground">
            JPEG, PNG, WebP — processed locally in your browser
          </p>
        </div>
      </div>
    </div>
  );
}
