/** Color helpers shared by WebGL + CPU grade paths. */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** "#E8A87C" → { r: 232, g: 168, b: 124 } */
export function hexToRgb(hex: string): RGB {
  const clean = hex.replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean.padEnd(6, "0").slice(0, 6);
  const int = parseInt(full, 16);
  if (Number.isNaN(int)) return { r: 0, g: 0, b: 0 };
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

/** { r: 232, g: 168, b: 124 } → "#e8a87c" */
export function rgbToHex({ r, g, b }: RGB): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return (
    "#" +
    [c(r), c(g), c(b)]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")
  );
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Rec.601 luminance — same weights the Python reference uses. */
export function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
