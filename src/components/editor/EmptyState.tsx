"use client";

import { UploadZone } from "./UploadZone";
import { Camera, Upload } from "lucide-react";

/** EmptyState — what the user sees before uploading any photo. */
export function EmptyState() {
  return (
    <UploadZone
      variant="area"
      className="grain-bg group relative h-full w-full"
    >
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.04]">
        {/* Stylized film camera glyph, oversized and centered */}
        <Camera className="h-[60vh] w-[60vh]" strokeWidth={0.5} />
      </div>

      <div className="relative flex flex-col items-center gap-4 px-6 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-2xl border border-amber-brand/30 bg-amber-brand/5 text-amber-brand shadow-[0_0_40px_-12px_rgba(232,168,124,0.4)] transition-transform duration-300 group-hover:scale-105">
          <Camera className="h-9 w-9" strokeWidth={1.25} />
        </div>
        <div className="space-y-1.5">
          <h2 className="font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Drop a photo to begin
          </h2>
          <p className="text-sm text-muted-foreground">
            Or{" "}
            <span className="inline-flex items-center gap-1 text-amber-brand underline-offset-4 group-hover:underline">
              <Upload className="h-3 w-3" /> click to browse
            </span>{" "}
            — JPEG, PNG, WebP supported
          </p>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
          <span>Real-time WebGL grade</span>
          <span className="text-amber-brand/40">·</span>
          <span>Film-accurate grain</span>
          <span className="text-amber-brand/40">·</span>
          <span>Full-res export</span>
        </div>
      </div>
    </UploadZone>
  );
}
