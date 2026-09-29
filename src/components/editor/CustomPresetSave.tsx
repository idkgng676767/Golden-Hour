"use client";

import { useState } from "react";
import { useEditorStore } from "@/store/editor-store";
import { Bookmark, Trash2, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/** CustomPresetSave — save current params as a named preset + apply/delete. */
export function CustomPresetSave() {
  const params = useEditorStore((s) => s.params);
  const customPresets = useEditorStore((s) => s.customPresets);
  const saveCustomPreset = useEditorStore((s) => s.saveCustomPreset);
  const deleteCustomPreset = useEditorStore((s) => s.deleteCustomPreset);
  const applyParams = useEditorStore((s) => s.applyParams);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Name your preset first");
      return;
    }
    setSaving(true);
    setTimeout(() => {
      saveCustomPreset(name);
      setName("");
      setSaving(false);
      toast.success("Preset saved", { description: "Stored in this browser." });
    }, 200);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
          placeholder="My preset name…"
          maxLength={32}
          className="h-8 flex-1 rounded-md border border-border bg-surface px-2.5 text-[12px] text-foreground placeholder:text-muted-foreground/60 focus:border-amber-brand/60 focus:outline-none focus:ring-1 focus:ring-amber-brand/30"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={!name.trim() || saving}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-amber-brand/40 bg-amber-brand/10 px-2.5 text-[12px] font-medium text-amber-brand transition-all hover:bg-amber-brand/20 active:scale-95 disabled:opacity-40"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          Save
        </button>
      </div>
      {customPresets.length > 0 ? (
        <ul className="space-y-1">
          {customPresets.map((p) => {
            const isActive =
              JSON.stringify(p.params) === JSON.stringify(params);
            return (
              <li
                key={p.id}
                className={cn(
                  "group flex items-center gap-2 rounded-md border px-2 py-1.5 transition-all",
                  isActive
                    ? "border-amber-brand/40 bg-amber-brand/5"
                    : "border-border bg-surface/60 hover:border-amber-brand/30"
                )}
              >
                <Bookmark
                  className={cn(
                    "h-3 w-3 shrink-0",
                    isActive ? "text-amber-brand" : "text-muted-foreground"
                  )}
                />
                <button
                  type="button"
                  onClick={() => applyParams(p.params, true)}
                  className="flex-1 truncate text-left text-[12px] font-medium text-foreground"
                  title={p.name}
                >
                  {p.name}
                </button>
                <span className="font-mono text-[10px] text-muted-foreground">
                  W{p.params.warmth.toFixed(2)}·G{p.params.grain.toFixed(0)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    deleteCustomPreset(p.id);
                    toast.success("Preset deleted");
                  }}
                  aria-label={`Delete ${p.name}`}
                  className="grid h-6 w-6 place-items-center rounded text-muted-foreground/60 opacity-0 transition-all hover:text-[#fda4af] group-hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-1 text-[11px] leading-snug text-muted-foreground/70">
          Save your current settings as a quick recall preset. Stored locally
          in this browser.
        </p>
      )}
    </div>
  );
}
