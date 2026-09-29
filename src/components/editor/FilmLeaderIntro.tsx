"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "golden-hour:intro-seen:v1";

/**
 * FilmLeaderIntro — a brief SMPTE-style film leader countdown animation
 * shown on first load only. Evokes the cinematic reel-leader vibe that
 * matches the film-grade aesthetic.
 *
 * After playing once, a flag is set in localStorage so subsequent loads skip
 * the intro (the user can replay it via the `introSeen` reset).
 */
export function FilmLeaderIntro() {
  // Lazy init: skip the intro entirely if already seen.
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    return !window.localStorage.getItem(STORAGE_KEY);
  });
  const [count, setCount] = useState(3);

  useEffect(() => {
    if (!visible) return;
    let n = 3;
    const tick = window.setInterval(() => {
      n -= 1;
      if (n < 0) {
        window.clearInterval(tick);
        setVisible(false);
        try {
          window.localStorage.setItem(STORAGE_KEY, "1");
        } catch {
          /* ignore */
        }
      } else {
        setCount(n);
      }
    }, 700);
    return () => window.clearInterval(tick);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
      style={{
        backgroundImage:
          "repeating-conic-gradient(from 0deg at 50% 50%, #0a0a0b 0deg 6deg, #15151a 6deg 12deg)",
      }}
      aria-hidden
    >
      {/* Center spinning reel */}
      <div className="relative grid h-48 w-48 place-items-center">
        {/* Outer rotating ring with ticks */}
        <div
          className="absolute inset-0 rounded-full border-2 border-amber-brand/30"
          style={{
            backgroundImage:
              "repeating-conic-gradient(from 0deg, transparent 0deg 9deg, rgba(232,168,124,0.5) 9deg 10deg)",
            animation: "spin-cw 1.4s linear infinite",
          }}
        />
        {/* Inner counter-rotating ring */}
        <div
          className="absolute inset-6 rounded-full border border-amber-brand/20"
          style={{
            backgroundImage:
              "repeating-conic-gradient(from 0deg, transparent 0deg 18deg, rgba(232,168,124,0.3) 18deg 19deg)",
            animation: "spin-ccw 2s linear infinite",
          }}
        />
        {/* Center countdown number */}
        <div className="relative">
          <div
            key={count}
            className="font-serif text-7xl font-bold text-amber-brand"
            style={{
              animation: "count-pop 0.6s ease-out",
              textShadow: "0 0 30px rgba(232,168,124,0.5)",
            }}
          >
            {count === 0 ? "" : count}
          </div>
        </div>
      </div>

      {/* Brand label */}
      <div className="absolute bottom-16 text-center">
        <div className="font-serif text-xl font-semibold tracking-wide text-foreground">
          GOLDEN HOUR
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.4em] text-muted-foreground">
          Vintage Film Color Grade
        </div>
      </div>

      {/* Corner crosshairs (SMPTE leader style) */}
      <Crosshair className="absolute left-8 top-8" />
      <Crosshair className="absolute right-8 top-8" />
      <Crosshair className="absolute left-8 bottom-8" />
      <Crosshair className="absolute right-8 bottom-8" />

      <style jsx>{`
        @keyframes spin-cw {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes spin-ccw {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes count-pop {
          0% { transform: scale(0.5); opacity: 0; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function Crosshair({ className }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none h-8 w-8 ${className ?? ""}`}
      style={{ color: "rgba(232,168,124,0.4)" }}
    >
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="16" cy="16" r="6" />
        <line x1="16" y1="0" x2="16" y2="10" />
        <line x1="16" y1="22" x2="16" y2="32" />
        <line x1="0" y1="16" x2="10" y2="16" />
        <line x1="22" y1="16" x2="32" y2="16" />
      </svg>
    </div>
  );
}
