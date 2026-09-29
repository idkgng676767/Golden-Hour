"use client";

import { UploadZone } from "./UploadZone";
import { Camera, Upload } from "lucide-react";

/** EmptyState — what the user sees before uploading any photo. */
export function EmptyState() {
  return (
    <UploadZone
      variant="area"
      className="group relative flex h-full w-full items-center justify-center"
    >
      <div className="relative flex flex-col items-center gap-5 px-6 text-center">
        {/* Hero camera glyph — clean, single focal point */}
        <div className="hero-halo relative grid h-20 w-20 place-items-center rounded-2xl border border-amber-brand/30 bg-amber-brand/5 text-amber-brand shadow-[0_0_40px_-12px_rgba(232,168,124,0.4)] transition-transform duration-300 group-hover:scale-105">
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
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground/40">
          Press <span className="text-amber-brand/60">?</span> for shortcuts
        </p>
      </div>
    </UploadZone>
  );
}
