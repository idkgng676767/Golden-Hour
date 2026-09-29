"use client";

import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/store/editor-store";
import type { GradeParams } from "@/lib/grade/types";
import { cn } from "@/lib/utils";
import { Pipette, Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface ColorPickerProps {
  param: "highlightTint" | "shadowTint";
  label: string;
  className?: string;
}

/** Quick-pick swatch palette — curated for the golden-hour aesthetic. */
const SWATCHES = [
  "#E8A87C", "#F4A261", "#E76F51", "#E9C46A", "#F1FAEE",
  "#142C3C", "#1A2F38", "#264653", "#2A9D8F", "#0A0A0B",
  "#C44536", "#8B5A2B", "#D4A373", "#FAF3DD", "#3A5A40",
];

/**
 * ColorPicker — swatch + hex input with a popover palette.
 *
 * Click the swatch to open a popover with:
 *  - A native color input for free-form picking
 *  - A hex text input for precise entry
 *  - 15 curated swatches for quick selection
 *  - A reset-to-default button
 */
export function ColorPicker({ param, label, className }: ColorPickerProps) {
  const value = useEditorStore((s) => s.params[param]);
  const defaultValue = param === "highlightTint" ? "#E8A87C" : "#142C3C";
  const setParam = useEditorStore((s) => s.setParam);
  const commit = useEditorStore((s) => s.commit);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [hexInput, setHexInput] = useState(value);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Sync the hex input when the external value changes (e.g. preset apply).
  useEffect(() => {
    setHexInput(value);
  }, [value]);

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const applyHex = (hex: string) => {
    const normalized = hex.startsWith("#") ? hex : "#" + hex;
    if (/^#[0-9A-Fa-f]{6}$/.test(normalized)) {
      commit();
      setParam(param as keyof GradeParams, normalized.toUpperCase());
    }
  };

  const handleHexSubmit = () => {
    const cleaned = hexInput.startsWith("#") ? hexInput : "#" + hexInput;
    if (/^#[0-9A-Fa-f]{6}$/.test(cleaned)) {
      applyHex(cleaned);
      setOpen(false);
    } else {
      toast.error("Invalid hex", { description: "Use format #RRGGBB" });
      setHexInput(value);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-medium text-foreground/90">{label}</div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground transition-colors hover:text-amber-brand"
          >
            {value}
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            commit();
            setOpen((v) => !v);
          }}
          className="relative h-9 w-9 shrink-0 rounded-lg border border-border shadow-inner transition-transform duration-150 hover:scale-105 active:scale-95"
          style={{ backgroundColor: value }}
          aria-label={`Pick ${label} color`}
          aria-expanded={open}
        >
          <span
            className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-inset ring-white/10"
            aria-hidden
          />
        </button>
      </div>

      {/* Hidden native input — still used as a fallback picker */}
      <input
        ref={inputRef}
        type="color"
        value={value}
        onChange={(e) => applyHex(e.target.value)}
        className="sr-only"
        aria-hidden
      />

      {/* Popover */}
      {open ? (
        <div
          ref={popoverRef}
          className="modal-enter absolute right-0 top-full z-50 mt-1 w-60 rounded-xl border border-border bg-popover p-3 shadow-2xl"
        >
          {/* Hex input row */}
          <div className="mb-2 flex items-center gap-2">
            <div
              className="h-8 w-8 shrink-0 rounded-md border border-border"
              style={{ backgroundColor: value }}
            />
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[12px] text-muted-foreground">
                #
              </span>
              <input
                type="text"
                value={hexInput.replace("#", "")}
                onChange={(e) => setHexInput("#" + e.target.value.toUpperCase().slice(0, 6))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleHexSubmit();
                }}
                maxLength={6}
                className="h-8 w-full rounded-md border border-border bg-surface pl-5 pr-2 font-mono text-[12px] uppercase text-foreground focus:border-amber-brand/60 focus:outline-none focus:ring-1 focus:ring-amber-brand/30"
                placeholder="RRGGBB"
                aria-label="Hex color input"
              />
            </div>
            <button
              type="button"
              onClick={handleHexSubmit}
              className="grid h-8 w-8 place-items-center rounded-md border border-amber-brand/40 bg-amber-brand/10 text-amber-brand transition-all hover:bg-amber-brand/20 active:scale-95"
              aria-label="Apply hex"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Swatch grid */}
          <div className="grid grid-cols-5 gap-1.5">
            {SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                onClick={() => {
                  applyHex(swatch);
                  setOpen(false);
                }}
                className={cn(
                  "h-7 w-7 rounded-md border transition-transform hover:scale-110 active:scale-95",
                  value.toUpperCase() === swatch.toUpperCase()
                    ? "border-amber-brand ring-1 ring-amber-brand/40"
                    : "border-border/60"
                )}
                style={{ backgroundColor: swatch }}
                aria-label={`Select ${swatch}`}
                title={swatch}
              />
            ))}
          </div>

          {/* Footer actions */}
          <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-amber-brand"
            >
              <Pipette className="h-3 w-3" />
              Custom picker
            </button>
            <button
              type="button"
              onClick={() => {
                applyHex(defaultValue);
                setOpen(false);
                toast.success(`${label} reset to default`);
              }}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-amber-brand"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
