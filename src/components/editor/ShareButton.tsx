"use client";

import { useState } from "react";
import { useEditorStore } from "@/store/editor-store";
import { buildShareURL } from "@/lib/grade/url";
import { toast } from "sonner";
import { Link2, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** ShareButton — copies a shareable URL with the current params to clipboard. */
export function ShareButton() {
  const params = useEditorStore((s) => s.params);
  const [state, setState] = useState<"idle" | "copying" | "copied">("idle");

  const handleShare = async () => {
    setState("copying");
    try {
      const curves = useEditorStore.getState().curves;
      const url = buildShareURL(params, curves);
      await navigator.clipboard.writeText(url);
      setState("copied");
      toast.success("Share link copied", {
        description: "Grade params embedded in the URL.",
      });
      setTimeout(() => setState("idle"), 1800);
    } catch (err) {
      console.error("[GoldenHour] share failed", err);
      toast.error("Couldn't copy link", {
        description: "Clipboard access was denied.",
      });
      setState("idle");
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      disabled={state === "copying"}
      title="Copy shareable link"
      aria-label="Copy shareable link"
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-[13px] font-medium transition-all active:scale-95",
        state === "copied"
          ? "border-[#86efac]/40 text-[#86efac]"
          : "text-muted-foreground hover:border-amber-brand/50 hover:text-amber-brand"
      )}
    >
      {state === "copying" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : state === "copied" ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <Link2 className="h-3.5 w-3.5" />
      )}
      <span className="hidden sm:inline">
        {state === "copied" ? "Copied" : "Share"}
      </span>
    </button>
  );
}
