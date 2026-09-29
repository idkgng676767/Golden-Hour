"use client";

import { useEffect, useRef } from "react";
import { useEditorStore } from "@/store/editor-store";
import { GradeRenderer } from "@/lib/grade/renderer";
import { PRESETS } from "@/lib/grade/presets";
import { DEFAULT_PARAMS } from "@/lib/grade/defaults";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PRESET_LIST = [
  { key: "subtle" as const, label: "Subtle", params: PRESETS.subtle.params },
  { key: "default" as const, label: "Default", params: PRESETS.default.params },
  { key: "max" as const, label: "Max", params: PRESETS.max.params },
  { key: "reset" as const, label: "Reset", params: { ...DEFAULT_PARAMS } },
];

/**
 * ComparePresetsModal — full-screen overlay rendering the current image with
 * each of the 4 built-in presets in a 2×2 grid. Clicking a tile applies that
 * preset to the editor and closes the modal.
 *
 * Each tile is an independent WebGL canvas sharing the same source image but
 * rendering with different params. The rAF loop is paused when the modal is
 * closed (component unmounts).
 */
export function ComparePresetsModal() {
  const open = useEditorStore((s) => s.compareOpen);
  const setOpen = useEditorStore((s) => s.setCompareOpen);
  const image = useEditorStore((s) => s.image);
  const rotation = useEditorStore((s) => s.rotation);
  const applyPreset = useEditorStore((s) => s.applyPreset);
  const applyParams = useEditorStore((s) => s.applyParams);
  const currentParams = useEditorStore((s) => s.params);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open || !image) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Compare presets"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 sm:px-6">
        <div>
          <h2 className="font-serif text-xl font-semibold text-foreground">
            Compare Presets
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Tap a tile to apply it to the editor.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-surface text-muted-foreground transition-all hover:text-foreground active:scale-95"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-2">
          {PRESET_LIST.map(({ key, label, params }) => {
            const isActive = JSON.stringify(params) === JSON.stringify(currentParams);
            return (
              <PresetTile
                key={key}
                label={label}
                params={params}
                imageUrl={image.url}
                rotation={rotation}
                active={isActive}
                onClick={() => {
                  if (key === "reset") applyParams(params, true);
                  else applyPreset(key);
                  toast.success(`Applied ${label} preset`);
                  setOpen(false);
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface PresetTileProps {
  label: string;
  params: typeof DEFAULT_PARAMS;
  imageUrl: string;
  rotation: 0 | 90 | 180 | 270;
  active: boolean;
  onClick: () => void;
}

function PresetTile({
  label,
  params,
  imageUrl,
  rotation,
  active,
  onClick,
}: PresetTileProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Render once on mount with the preset params.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: GradeRenderer | null = null;
    let raf = 0;
    try {
      renderer = new GradeRenderer(canvas);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        renderer!.setImage(img, 600, rotation);
        const { w, h } = renderer!.dims;
        renderer!.resizeCanvas(w, h, Math.min(window.devicePixelRatio || 1, 2));
        // Animate grain via rAF.
        const loop = (t: number) => {
          renderer!.draw(params, t / 1000, false);
          raf = requestAnimationFrame(loop);
        };
        raf = requestAnimationFrame(loop);
      };
      img.src = imageUrl;
    } catch (err) {
      console.warn("[Compare] WebGL tile failed", err);
    }
    return () => {
      cancelAnimationFrame(raf);
      renderer?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUrl, rotation, JSON.stringify(params)]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-checker text-left transition-all duration-200",
        active
          ? "border-amber-brand ring-2 ring-amber-brand/30"
          : "border-border hover:border-amber-brand/50"
      )}
    >
      <div className="aspect-[4/3] w-full">
        <canvas ref={canvasRef} className="h-full w-full object-contain" />
      </div>
      <div className="absolute left-3 top-3 rounded-md bg-black/60 px-2 py-1 backdrop-blur-sm">
        <span className="font-serif text-sm font-semibold text-foreground">
          {label}
        </span>
      </div>
      {active ? (
        <div className="absolute right-3 top-3 rounded-full bg-amber-brand px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-foreground">
          Active
        </div>
      ) : null}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-6 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        <div className="flex items-center justify-between font-mono text-[10px] text-white/80">
          <span>W{params.warmth.toFixed(2)}</span>
          <span>G{params.grain.toFixed(0)}</span>
          <span>V{params.vignette.toFixed(2)}</span>
          <span>T{params.tintStrength.toFixed(2)}</span>
        </div>
      </div>
    </button>
  );
}
