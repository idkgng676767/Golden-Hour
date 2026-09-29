"use client";

import { useEditorStore } from "@/store/editor-store";
import { RotateCw, Maximize2, HelpCircle, LayoutGrid } from "lucide-react";

function formatBytes(bytes: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function aspectRatio(w: number, h: number): string {
  if (!w || !h) return "—";
  const g = gcd(w, h);
  return `${w / g}:${h / g}`;
}

/**
 * ImageInfoBar — slim header above the preview showing dimensions, format,
 * size, aspect ratio, plus rotate / compare / help controls.
 */
export function ImageInfoBar() {
  const image = useEditorStore((s) => s.image);
  const rotation = useEditorStore((s) => s.rotation);
  const rotateCW = useEditorStore((s) => s.rotateCW);
  const setCompareOpen = useEditorStore((s) => s.setCompareOpen);
  const setHelpOpen = useEditorStore((s) => s.setHelpOpen);

  if (!image) return null;

  // Display dims AFTER rotation.
  const rotated = rotation % 180 !== 0;
  const dispW = rotated ? image.height : image.width;
  const dispH = rotated ? image.width : image.height;

  const formatLabel = image.type.replace("image/", "").toUpperCase();

  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-surface/40 px-3 py-1.5 text-[11px] text-muted-foreground">
      <div className="flex min-w-0 items-center gap-2 overflow-hidden">
        <span className="truncate font-medium text-foreground/80" title={image.name}>
          {image.name}
        </span>
        <span className="text-border">·</span>
        <span className="font-mono tabular-nums">
          {dispW}×{dispH}
        </span>
        <span className="text-border">·</span>
        <span className="uppercase">{formatLabel}</span>
        <span className="text-border">·</span>
        <span className="font-mono tabular-nums">{formatBytes(image.size)}</span>
        <span className="hidden text-border sm:inline">·</span>
        <span className="hidden font-mono tabular-nums sm:inline">
          {aspectRatio(dispW, dispH)}
        </span>
        {rotation !== 0 ? (
          <>
            <span className="hidden text-border sm:inline">·</span>
            <span className="hidden font-mono text-amber-brand sm:inline">
              ↻{rotation}°
            </span>
          </>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={rotateCW}
          title="Rotate 90° (R)"
          aria-label="Rotate image 90 degrees"
          className="grid h-7 w-7 place-items-center rounded-md border border-border bg-surface text-muted-foreground transition-all hover:text-amber-brand active:scale-95"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setCompareOpen(true)}
          title="Compare presets (C)"
          aria-label="Compare presets"
          className="grid h-7 w-7 place-items-center rounded-md border border-border bg-surface text-muted-foreground transition-all hover:text-amber-brand active:scale-95"
        >
          <LayoutGrid className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setHelpOpen(true)}
          title="Keyboard shortcuts (?)"
          aria-label="Help"
          className="grid h-7 w-7 place-items-center rounded-md border border-border bg-surface text-muted-foreground transition-all hover:text-amber-brand active:scale-95"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// Re-export icon for usage in EmptyState placeholder if needed
export { Maximize2 };
