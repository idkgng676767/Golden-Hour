"use client";

import { useEffect, useRef } from "react";
import { useEditorStore } from "@/store/editor-store";
import { useGlobalDragDrop, UploadZone } from "@/components/editor/UploadZone";
import { EmptyState } from "@/components/editor/EmptyState";
import { BeforeAfterSlider } from "@/components/editor/BeforeAfterSlider";
import { ControlPanel } from "@/components/editor/ControlPanel";
import { DownloadButton } from "@/components/editor/DownloadButton";
import { ShareButton } from "@/components/editor/ShareButton";
import { ImageInfoBar } from "@/components/editor/ImageInfoBar";
import { ComparePresetsModal } from "@/components/editor/ComparePresetsModal";
import { KeyboardHelpDialog } from "@/components/editor/KeyboardHelpDialog";
import { GradeRenderer } from "@/lib/grade/renderer";
import { buildShareURL } from "@/lib/grade/url";
import { toast } from "sonner";
import { Toaster as SonnerToaster } from "sonner";
import { cn } from "@/lib/utils";
import { Sun, Undo2, Redo2, Upload } from "lucide-react";
import { HistoryScrubber } from "@/components/editor/HistoryScrubber";
import { FilmLeaderIntro } from "@/components/editor/FilmLeaderIntro";
import { PreviewHistogram } from "@/components/editor/PreviewHistogram";

export default function Home() {
  const image = useEditorStore((s) => s.image);
  const rotation = useEditorStore((s) => s.rotation);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const past = useEditorStore((s) => s.past);
  const future = useEditorStore((s) => s.future);
  const applyPreset = useEditorStore((s) => s.applyPreset);
  const applyParams = useEditorStore((s) => s.applyParams);
  const customPresets = useEditorStore((s) => s.customPresets);
  const hydrateFromStorage = useEditorStore((s) => s.hydrateFromStorage);
  const hydrateFromURL = useEditorStore((s) => s.hydrateFromURL);
  const setHelpOpen = useEditorStore((s) => s.setHelpOpen);
  const setCompareOpen = useEditorStore((s) => s.setCompareOpen);
  const rotateCW = useEditorStore((s) => s.rotateCW);
  const isDragging = useGlobalDragDrop();
  const rendererRef = useRef<GradeRenderer | null>(null);

  // Hydrate: URL hash takes precedence (shareable links), then localStorage.
  useEffect(() => {
    const fromURL = hydrateFromURL();
    if (!fromURL) hydrateFromStorage();
  }, [hydrateFromURL, hydrateFromStorage]);

  // Global keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      // `?` opens help (ignore when typing)
      if (!isTyping && (e.key === "?" || (e.shiftKey && e.key === "/"))) {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }
      // `C` opens compare (ignore when typing)
      if (!isTyping && !meta && e.key.toLowerCase() === "c") {
        e.preventDefault();
        setCompareOpen(true);
        return;
      }
      // `R` rotates
      if (!isTyping && !meta && e.key.toLowerCase() === "r") {
        e.preventDefault();
        rotateCW();
        return;
      }
      // `V` cycles before/after handle mode (vertical ↔ diagonal)
      // (handled inside BeforeAfterSlider, but we also need to prevent
      //  default to avoid browser conflicts — the component listens itself.)
      // `J` / `K` step through custom presets (film contact-sheet vibe).
      //   J = previous, K = next.
      if (!isTyping && !meta && (e.key.toLowerCase() === "j" || e.key.toLowerCase() === "k")) {
        const presets = useEditorStore.getState().customPresets;
        if (presets.length === 0) return;
        e.preventDefault();
        const currentParams = useEditorStore.getState().params;
        // Find the index of the currently-active custom preset, if any.
        let activeIdx = -1;
        for (let i = 0; i < presets.length; i++) {
          if (JSON.stringify(presets[i].params) === JSON.stringify(currentParams)) {
            activeIdx = i;
            break;
          }
        }
        const dir = e.key.toLowerCase() === "j" ? -1 : 1;
        // Wrap around.
        const nextIdx =
          activeIdx === -1
            ? dir === 1
              ? 0
              : presets.length - 1
            : (activeIdx + dir + presets.length) % presets.length;
        const target = presets[nextIdx];
        applyParams(target.params, true);
        toast.success(`Preset ${nextIdx + 1}/${presets.length}: ${target.name}`);
        return;
      }
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
      // Cmd/Ctrl+C — copy shareable link (only when no text is selected)
      else if (meta && e.key.toLowerCase() === "c" && !isTyping) {
        e.preventDefault();
        const state = useEditorStore.getState();
        const url = buildShareURL(state.params, state.curves);
        navigator.clipboard
          .writeText(url)
          .then(() => toast.success("Share link copied"))
          .catch(() => toast.error("Couldn't copy link"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, setHelpOpen, setCompareOpen, rotateCW, applyParams]);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <FilmLeaderIntro />
      <SonnerToaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "rgba(24, 24, 27, 0.95)",
            border: "1px solid rgba(232, 168, 124, 0.25)",
            color: "#fafafa",
          },
        }}
      />

      {/* ---- Top bar ---- */}
      <header className="top-bar-glow sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-amber-brand/30 bg-amber-brand/5 text-amber-brand shadow-[0_0_24px_-8px_rgba(232,168,124,0.6)]">
            <Sun className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <h1 className="gradient-title truncate font-serif text-lg font-semibold leading-tight sm:text-xl">
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
          <ShareButton />
          {past.length > 0 || future.length > 0 ? (
            <div className="hidden md:block">
              <HistoryScrubber />
            </div>
          ) : null}
          <button
            type="button"
            onClick={undo}
            disabled={past.length === 0}
            aria-label="Undo"
            title="Undo (⌘Z)"
            className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface text-muted-foreground transition-all hover:text-foreground active:scale-95 disabled:opacity-30 md:hidden"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={future.length === 0}
            aria-label="Redo"
            title="Redo (⌘⇧Z)"
            className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface text-muted-foreground transition-all hover:text-foreground active:scale-95 disabled:opacity-30 md:hidden"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          {image ? (
            <span data-download-trigger className="contents">
              <DownloadButton rendererRef={rendererRef} />
            </span>
          ) : null}
        </div>
      </header>

      {/* ---- Main layout ---- */}
      <main className="flex flex-1 flex-col gap-3 p-3 sm:p-4 lg:flex-row lg:gap-4">
        {/* Left: image preview (65% on desktop) */}
        <div className="relative flex min-h-[55vh] flex-1 flex-col overflow-hidden rounded-xl border border-border bg-surface lg:min-h-0 lg:basis-[65%]">
          <ImageInfoBar />
          <div className="easel-corners relative flex flex-1 items-center justify-center">
            {image ? (
              <BeforeAfterSlider className="h-full max-h-[calc(100vh-9rem)] w-full" />
            ) : (
              <EmptyState />
            )}
            {/* Inline preview histogram (Lightroom-style) */}
            {image ? <PreviewHistogram /> : null}
            {/* Easel corner marks — the two pseudo-element corners are via
                .easel-corners (top-left + bottom-right). These two spans
                add the remaining corners (top-right + bottom-left). */}
            <span className="pointer-events-none absolute right-2.5 top-2.5 z-[5] h-[22px] w-[22px] border-amber-brand/55 border-r-[1.5px] border-t-[1.5px]" aria-hidden />
            <span className="pointer-events-none absolute bottom-2.5 left-2.5 z-[5] h-[22px] w-[22px] border-amber-brand/55 border-b-[1.5px] border-l-[1.5px]" aria-hidden />
          </div>
        </div>

        {/* Right: control panel (35% on desktop) */}
        <aside className="flex shrink-0 flex-col rounded-xl border border-border bg-surface/40 lg:basis-[35%] lg:w-[380px]">
          {/* Panel header */}
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-brand/40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-brand" />
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                Develop
              </span>
            </div>
            <button
              type="button"
              onClick={() => applyPreset("reset")}
              className="text-[11px] font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-amber-brand hover:underline"
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

      {/* ---- Modals & overlays ---- */}
      <ComparePresetsModal />
      <KeyboardHelpDialog />

      {/* ---- Global drag-and-drop overlay ---- */}
      <div
        className={cn(
          "pointer-events-none fixed inset-0 z-50 flex items-center justify-center transition-opacity duration-200",
          isDragging ? "opacity-100" : "opacity-0"
        )}
      >
        <div className="absolute inset-4 rounded-2xl border-2 border-dashed border-amber-brand bg-amber-brand/5 backdrop-blur-[2px]" />
        <div className="modal-enter relative rounded-2xl border border-amber-brand/40 bg-background/90 px-8 py-6 text-center shadow-2xl">
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
