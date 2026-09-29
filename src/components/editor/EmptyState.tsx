"use client";

import { UploadZone } from "./UploadZone";
import { Camera, Upload, Aperture, Film } from "lucide-react";

/** EmptyState — what the user sees before uploading any photo. */
export function EmptyState() {
  return (
    <UploadZone
      variant="area"
      className="grain-bg group relative h-full w-full"
    >
      {/* Oversized faded camera glyph in the background */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.04]">
        <Camera className="h-[60vh] w-[60vh]" strokeWidth={0.5} />
      </div>

      {/* Film perforation strip — top edge */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-7 items-center justify-around border-b border-amber-brand/30 bg-black/50 backdrop-blur-sm">
        {Array.from({ length: 28 }).map((_, i) => (
          <span
            key={i}
            className="h-3.5 w-2.5 rounded-[2px] bg-amber-brand/55"
            style={{ animation: `perf-pulse 2s ease-in-out ${(i % 5) * 0.2}s infinite` }}
          />
        ))}
      </div>
      {/* Film perforation strip — bottom edge */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex h-7 items-center justify-around border-t border-amber-brand/30 bg-black/50 backdrop-blur-sm">
        {Array.from({ length: 28 }).map((_, i) => (
          <span
            key={i}
            className="h-3.5 w-2.5 rounded-[2px] bg-amber-brand/55"
            style={{ animation: `perf-pulse 2s ease-in-out ${(i % 5) * 0.2 + 0.5}s infinite` }}
          />
        ))}
      </div>

      <div className="relative flex flex-col items-center gap-4 px-6 text-center">
        {/* Hero camera glyph with rotating aperture ring + amber halo */}
        <div className="hero-halo relative grid h-20 w-20 place-items-center rounded-2xl border border-amber-brand/30 bg-amber-brand/5 text-amber-brand shadow-[0_0_40px_-12px_rgba(232,168,124,0.4)] transition-transform duration-300 group-hover:scale-105">
          <Camera className="h-9 w-9" strokeWidth={1.25} />
          {/* Rotating aperture ring */}
          <Aperture
            className="absolute -inset-2 h-24 w-24 text-amber-brand/20"
            strokeWidth={0.75}
            style={{
              animation: "spin-slow 12s linear infinite",
              transformOrigin: "center",
            }}
          />
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

        {/* Feature pills */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground/70">
          <span className="inline-flex items-center gap-1.5">
            <Film className="h-3 w-3" /> Real-time WebGL grade
          </span>
          <span className="text-amber-brand/40">·</span>
          <span>Film-accurate grain</span>
          <span className="text-amber-brand/40">·</span>
          <span>Full-res export</span>
        </div>

        {/* Hint line */}
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground/40">
          Press <span className="text-amber-brand/70">?</span> for shortcuts
        </p>
      </div>

      <style jsx>{`
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </UploadZone>
  );
}
