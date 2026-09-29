"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/store/editor-store";
import type { LoadedImage } from "@/store/editor-store";
import { cn } from "@/lib/utils";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "image/bmp"];

async function readFile(file: File): Promise<LoadedImage> {
  const url = URL.createObjectURL(file);
  // Read natural dimensions before storing.
  const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error("Failed to decode image"));
    img.src = url;
  });
  return { url, width: dims.w, height: dims.h, name: file.name };
}

/** Global drag-and-drop listener that overlays a drop hint on the page. */
export function useGlobalDragDrop() {
  const setImage = useEditorStore((s) => s.setImage);
  const [isDragging, setDragging] = useState(false);
  const counterRef = useRef(0);

  useEffect(() => {
    const onEnter = (e: DragEvent) => {
      e.preventDefault();
      if (!e.dataTransfer?.types?.includes("Files")) return;
      counterRef.current += 1;
      setDragging(true);
    };
    const onOver = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
    };
    const onLeave = (e: DragEvent) => {
      e.preventDefault();
      counterRef.current = Math.max(0, counterRef.current - 1);
      if (counterRef.current === 0) setDragging(false);
    };
    const onDrop = async (e: DragEvent) => {
      e.preventDefault();
      counterRef.current = 0;
      setDragging(false);
      const file = e.dataTransfer?.files?.[0];
      if (!file || !ACCEPTED.includes(file.type)) return;
      try {
        setImage(await readFile(file));
      } catch (err) {
        console.error(err);
      }
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [setImage]);

  return isDragging;
}

interface UploadZoneProps {
  className?: string;
  variant?: "button" | "area";
  children?: React.ReactNode;
}

export function UploadZone({ className, variant = "button", children }: UploadZoneProps) {
  const setImage = useEditorStore((s) => s.setImage);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file || !ACCEPTED.includes(file.type)) return;
      try {
        setImage(await readFile(file));
      } catch (err) {
        console.error(err);
      }
    },
    [setImage]
  );

  if (variant === "area") {
    return (
      <div
        className={cn(
          "flex h-full w-full cursor-pointer flex-col items-center justify-center text-center",
          className
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFile(e.dataTransfer.files?.[0]);
        }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED.join(",")}
          className="sr-only"
          onChange={(e) => handleFile(e.target.files?.[0] ?? undefined)}
        />
        {children}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-[13px] font-medium text-foreground transition-all hover:border-amber-brand/50 hover:text-amber-brand active:scale-[0.97]",
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="sr-only"
        onChange={(e) => handleFile(e.target.files?.[0] ?? undefined)}
      />
      {children}
    </button>
  );
}
