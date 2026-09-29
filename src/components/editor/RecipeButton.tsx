"use client";

import { useRef, useState } from "react";
import { useEditorStore } from "@/store/editor-store";
import type { GradeParams, SelectiveParams } from "@/lib/grade/types";
import type { Curves } from "@/lib/grade/curve";
import { DEFAULT_PARAMS, DEFAULT_SELECTIVE } from "@/lib/grade/defaults";
import { DEFAULT_CURVES, cloneCurves } from "@/lib/grade/curve";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Download, Upload, FileJson, X } from "lucide-react";

/** The recipe JSON schema version — bump if the format changes. */
const RECIPE_VERSION = 1;

interface Recipe {
  version: number;
  app: string;
  exportedAt: string;
  params: GradeParams;
  curves: Curves;
  rotation: 0 | 90 | 180 | 270;
  selective: SelectiveParams;
}

/**
 * RecipeButton — export/import the full edit state as a JSON file.
 *
 * EXPORT: serializes params + curves + rotation + selective into a
 *   `golden-hour-recipe.json` file downloaded to the user's machine.
 * IMPORT: reads a recipe JSON file and restores the full edit state.
 *
 * This is complementary to the shareable URL (which encodes the same data
 * compactly). Recipes are useful for backups, sharing grade settings
 * offline, or applying a grade to a different photo later.
 */
export function RecipeButton({ className }: { className?: string }) {
  const params = useEditorStore((s) => s.params);
  const curves = useEditorStore((s) => s.curves);
  const rotation = useEditorStore((s) => s.rotation);
  const selective = useEditorStore((s) => s.selective);
  const applyParams = useEditorStore((s) => s.applyParams);
  const setRotation = useEditorStore((s) => s.setRotation);
  const setSelectiveParam = useEditorStore((s) => s.setSelectiveParam);
  const [menuOpen, setMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const recipe: Recipe = {
      version: RECIPE_VERSION,
      app: "Golden Hour",
      exportedAt: new Date().toISOString(),
      params: { ...params },
      curves: cloneCurves(curves),
      rotation,
      selective: { ...selective },
    };
    const blob = new Blob([JSON.stringify(recipe, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `golden-hour-recipe-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMenuOpen(false);
    toast.success("Recipe exported", {
      description: "Full edit state saved as JSON.",
    });
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as Partial<Recipe>;
      if (!data || data.app !== "Golden Hour" || !data.params) {
        toast.error("Invalid recipe", {
          description: "Not a Golden Hour recipe file.",
        });
        return;
      }
      // Restore params (validate against defaults for missing keys).
      const restoredParams: GradeParams = { ...DEFAULT_PARAMS, ...data.params };
      applyParams(restoredParams, true);
      // Restore curves.
      if (data.curves) {
        const c = cloneCurves(DEFAULT_CURVES);
        (["master", "r", "g", "b"] as const).forEach((ch) => {
          if (data.curves && data.curves[ch]) {
            c[ch].points = data.curves[ch].points as typeof c[typeof ch]["points"];
          }
        });
        // Direct store set via setCurvePoint would be tedious; use setState.
        useEditorStore.setState({ curves: c });
      }
      // Restore rotation.
      if (typeof data.rotation === "number") {
        setRotation(data.rotation as 0 | 90 | 180 | 270);
      }
      // Restore selective.
      if (data.selective) {
        const sel: SelectiveParams = { ...DEFAULT_SELECTIVE, ...data.selective };
        useEditorStore.setState({ selective: sel });
      }
      setMenuOpen(false);
      toast.success("Recipe imported", {
        description: "Full edit state restored.",
      });
    } catch (err) {
      console.error("[Recipe] import failed", err);
      toast.error("Import failed", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        title="Export/import recipe"
        aria-label="Export or import recipe"
        aria-expanded={menuOpen}
        className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface text-muted-foreground transition-all hover:border-amber-brand/50 hover:text-amber-brand active:scale-95"
      >
        <FileJson className="h-4 w-4" />
      </button>
      {menuOpen ? (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setMenuOpen(false)}
          />
          <div className="modal-enter absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
            <button
              type="button"
              onClick={handleExport}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-surface-elevated"
            >
              <Download className="h-3.5 w-3.5 text-amber-brand" />
              <div>
                <div className="font-medium">Export recipe</div>
                <div className="text-[10px] text-muted-foreground">Download JSON</div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] text-foreground transition-colors hover:bg-surface-elevated"
            >
              <Upload className="h-3.5 w-3.5 text-amber-brand" />
              <div>
                <div className="font-medium">Import recipe</div>
                <div className="text-[10px] text-muted-foreground">Restore from JSON</div>
              </div>
            </button>
          </div>
        </>
      ) : null}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImport(file);
          e.target.value = ""; // reset for re-import
        }}
      />
    </div>
  );
}

/** Unused export to keep X import (for future close button). */
export { X };
