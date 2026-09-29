"use client";

import { useState } from "react";
import { useEditorStore } from "@/store/editor-store";
import { renderFullRes } from "@/lib/grade/renderer";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Download, Loader2, ChevronDown, Image as ImageIcon } from "lucide-react";

interface DownloadButtonProps {
  /** Optional ref to the live preview renderer (unused for now, reserved for
   *  a future "export current preview frame" fast path). */
  rendererRef?: React.MutableRefObject<unknown>;
}

/**
 * DownloadButton — exports the full-resolution graded image.
 *
 * Uses an offscreen WebGL canvas (same shader, no downscale) and falls back
 * to the CPU grade path if WebGL is unavailable. The format menu toggles
 * JPEG (quality 92) and PNG. Honors the current rotation.
 */
export function DownloadButton(_props: DownloadButtonProps = {}) {
  const image = useEditorStore((s) => s.image);
  const params = useEditorStore((s) => s.params);
  const rotation = useEditorStore((s) => s.rotation);
  const curves = useEditorStore((s) => s.curves);
  const format = useEditorStore((s) => s.exportFormat);
  const setFormat = useEditorStore((s) => s.setExportFormat);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const handleDownload = async () => {
    if (!image) return;
    setBusy(true);
    try {
      // Decode the original at full res for the export pipeline.
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = image.url;
      await img.decode();
      const blob = await renderFullRes(img, params, format, 0.92, rotation, curves);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const base = image.name.replace(/\.[^.]+$/, "") || "golden-hour";
      a.href = url;
      a.download = `${base}_golden-hour.${format === "png" ? "png" : "jpg"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Export complete", {
        description: `${format.toUpperCase()} · ${blob.size > 1024 * 1024 ? (blob.size / 1024 / 1024).toFixed(1) + " MB" : Math.round(blob.size / 1024) + " KB"}`,
      });
    } catch (err) {
      console.error("[GoldenHour] export failed", err);
      toast.error("Export failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex items-stretch">
      <button
        type="button"
        disabled={!image || busy}
        onClick={handleDownload}
        className={cn(
          "inline-flex items-center gap-2 rounded-l-lg bg-amber-brand px-4 py-1.5 text-[13px] font-semibold text-amber-foreground shadow-[0_4px_14px_-4px_rgba(232,168,124,0.5)] transition-all hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
        )}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">
          {busy ? "Exporting…" : "Download"}
        </span>
        <span className="ml-1 hidden font-mono text-[10px] uppercase opacity-70 sm:inline">
          {format}
        </span>
      </button>
      <button
        type="button"
        disabled={!image || busy}
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Choose export format"
        className="inline-flex items-center rounded-r-lg border-y border-r border-amber-brand/40 bg-amber-brand/90 px-1.5 text-amber-foreground transition-all hover:bg-amber-brand active:scale-[0.97] disabled:opacity-40"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {menuOpen ? (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
            {(["jpeg", "png"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setFormat(f);
                  setMenuOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors hover:bg-surface-elevated",
                  format === f ? "text-amber-brand" : "text-foreground"
                )}
              >
                <ImageIcon className="h-3.5 w-3.5 opacity-70" />
                <span className="uppercase">{f}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {f === "jpeg" ? "q92" : "lossless"}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
