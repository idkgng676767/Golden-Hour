"use client";

import { useRef } from "react";
import { useEditorStore } from "@/store/editor-store";
import type { GradeParams } from "@/lib/grade/types";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  param: "highlightTint" | "shadowTint";
  label: string;
  className?: string;
}

/**
 * ColorPicker — swatch + hex label that opens the native color input.
 * No popover; just a clickable swatch with the hex code rendered in mono.
 */
export function ColorPicker({ param, label, className }: ColorPickerProps) {
  const value = useEditorStore((s) => s.params[param]);
  const setParam = useEditorStore((s) => s.setParam);
  const commit = useEditorStore((s) => s.commit);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-foreground/90">{label}</div>
        <div className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          {value}
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          commit();
          inputRef.current?.click();
        }}
        className="relative h-9 w-9 shrink-0 rounded-lg border border-border shadow-inner transition-transform duration-150 hover:scale-105 active:scale-95"
        style={{ backgroundColor: value }}
        aria-label={`Pick ${label} color`}
      >
        <span
          className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-inset ring-white/10"
          aria-hidden
        />
      </button>
      <input
        ref={inputRef}
        type="color"
        value={value}
        onChange={(e) => setParam(param as keyof GradeParams, e.target.value)}
        className="sr-only"
        aria-hidden
      />
    </div>
  );
}
