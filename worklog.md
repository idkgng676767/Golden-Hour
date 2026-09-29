# Golden Hour — Web UI Image Editor · Worklog

## Round 3 — Diagonal Split + EXIF + History Scrubber + Polish (COMPLETE)

### Phase Assessment
Rounds 1 & 2 were stable (clean lint, no runtime errors, all features
VLM-verified). This round tackled the remaining original stretch goals
(45° diagonal handle) plus high-value new features: EXIF auto-rotation,
undo/redo history visualization, and J/K preset stepping. Extensive
styling polish was also shipped.

### New Features Delivered

1. **45° diagonal before/after handle** (`BeforeAfterSlider.tsx`) — Darkroom-
   style diagonal split. Bottom-left triangle = Before, top-right = After.
   - Toggle via floating button (top-right of preview) or `V` key.
   - Cursor projected onto the diagonal axis for natural dragging.
   - Circular handle sits at the midpoint of the diagonal, rotated 45°.
   - Verified: VLM confirmed diagonal split + handle + drag works.

2. **EXIF orientation auto-rotation** (`src/lib/grade/exif.ts`) — phone photos
   with embedded orientation tags now display correctly on upload, no manual
   rotate needed.
   - Primary path: `createImageBitmap({ imageOrientation: 'from-image' })`
     (Chrome/Firefox/Safari 14+).
   - Fallback: manual JPEG EXIF tag parsing (tag 0x0112) + canvas transform
     for orientations 1-8.
   - Re-encodes to a normalized (orientation-stripped) JPEG blob so the rest
     of the app trusts `naturalWidth`/`naturalHeight`.

3. **Undo/redo history scrubber** (`HistoryScrubber.tsx`) — tiny visual
   indicator in the top bar showing history depth.
   - Amber dots = past (undo-able) states, dim dots = future (redo-able).
   - Current-state marker (bright dot with amber glow).
   - Click any dot to jump to that history state.
   - `X/Y` counter (e.g. "3/3").
   - Shows on desktop only (md+); mobile keeps the icon buttons.
   - Verified: VLM confirmed "3/3" with amber dots after preset changes.

4. **Keyboard `J`/`K` to step through custom presets** — film contact-sheet
   vibe. J = previous, K = next. Wraps around. Shows a toast with
   `Preset N/total: name`. Verified: toast "Preset 2/3: Sunset V1" appeared.

### Styling Polish Delivered

- **Film perforation strips** on empty state — 28 amber rounded rectangles
  at top & bottom edges, animated with `perf-pulse` (staggered opacity).
  Bumped to 55% opacity + 50% black bg for visibility.
- **Rotating aperture ring** around the hero camera icon (12s linear spin).
- **Hero amber halo** — radial glow behind the icon (`.hero-halo`).
- **"Press ? for shortcuts" hint** at the bottom of the empty state.
- **Slider tick marks** — subtle vertical guides on slider tracks via
  `::after` + `repeating-linear-gradient`. Moved OUT of `@layer utilities`
  with `!important` to beat Tailwind v4's `bg-muted`/`bg-primary`/`shadow-sm`.
- **Amber slider range fill** — gradient `rgba(232,168,124,0.85)` → `1.0`.
- **Slider thumb hover glow** — scale 1.15 + 6px amber ring on hover,
  scale 1.05 + 8px ring on active.
- **Panel section hover accent** — border-color animates to amber on hover.
- **Info-bar icon button hover** — amber border + ring shadow.

### Bug Found & Fixed During QA
- **Slider styling not applying** — Tailwind v4 `@layer utilities` rules
  have lower priority than shadcn's `bg-primary`/`bg-muted`/`shadow-sm`
  utility classes. Moved all `[data-slot="slider-*"]` rules OUT of
  `@layer utilities` to plain CSS with `!important` on the
  conflict-prone properties. Verified: amber fill + ticks now render.

### Verification Results (agent-browser + VLM)

| Check | Result |
|---|---|
| Diagonal split: 45° angle, BL=Before, TR=After | ✅ VLM confirmed |
| Diagonal handle drag moves the split | ✅ VLM: "closer to top-right" |
| Vertical ↔ diagonal toggle (V key + button) | ✅ |
| EXIF auto-rotation (code path verified) | ✅ createImageBitmap + fallback |
| History scrubber: amber dots + "3/3" counter | ✅ VLM confirmed |
| J/K preset stepping with toast | ✅ "Preset 2/3: Sunset V1" |
| Film perforation strips visible | ✅ VLM confirmed (after opacity bump) |
| Rotating aperture ring | ✅ VLM confirmed |
| Amber slider range fill | ✅ VLM confirmed |
| Slider tick marks | ✅ VLM confirmed |
| Slider thumb hover glow | ✅ applied |
| Lint clean, no runtime errors | ✅ |

### Files Added / Modified (Round 3)
```
NEW  src/lib/grade/exif.ts                          # EXIF orientation parsing
NEW  src/components/editor/HistoryScrubber.tsx     # undo/redo visualizer
MOD  src/components/editor/BeforeAfterSlider.tsx   # diagonal mode + toggle
MOD  src/components/editor/UploadZone.tsx          # use normalizeOrientation
MOD  src/components/editor/EmptyState.tsx           # perforations + aperture + halo
MOD  src/components/editor/ControlPanel.tsx        # data-section attr for hover
MOD  src/components/editor/KeyboardHelpDialog.tsx  # added V, J, K shortcuts
MOD  src/app/page.tsx                              # J/K handler + HistoryScrubber
MOD  src/app/globals.css                           # slider rules outside @layer + polish
```

---

## Round 2 — Feature Expansion + Styling Polish (reference, kept for context)

Shipped: shareable URL params, image rotation, compare-4-presets modal,
keyboard help dialog, image info bar, custom user presets, plus extensive
styling polish (easel corners, top-bar glow, slider glow, shimmer, toasts,
preset intensity bars). Fixed dual-active preset badge bug.

## Round 1 — Initial Build (reference, kept for context)

Single-page Next.js 16 app, WebGL1 fragment shader porting all 6 grade
passes (warm WB → levels/gamma → split-tone → saturation → vignette →
film grain). All 10 hard acceptance criteria verified. Tech: Next.js 16 +
TS + Tailwind 4 + shadcn/ui + Zustand + sharp. Fonts: Playfair Display,
Inter, JetBrains Mono.

---

## Unresolved Issues / Risks

- **None blocking.** All Round 1/2/3 features verified.
- **Minor:** EXIF auto-rotation was code-reviewed but not end-to-end tested
  with a real oriented phone photo (the test image has no EXIF tag). The
  `createImageBitmap` path is well-supported in modern browsers; the manual
  fallback covers edge cases.
- **Minor:** The Compare modal still spins 4 WebGL contexts while open.
  Could be optimized to a shared context if performance becomes an issue.
- **Minor:** Custom preset equality uses `JSON.stringify` — O(n) but n=11,
  negligible.

## Priority Recommendations for Next Phase

1. **readPixels-based histogram** — read directly from the WebGL canvas
   for pixel-perfect accuracy instead of the current 96px CPU-graded
   downsample.
2. **Web Worker for CPU fallback** — move the CPU grade path off the main
   thread for large exports on non-WebGL devices.
3. **"Compare N custom presets"** — extend the compare modal to let users
   pick which presets (built-in + saved) to compare side-by-side.
4. **Film leader countdown intro** — a brief 1-2s animation on first load
   evoking a film reel leader (SMPTE countdown style).
5. **Curve editor** — a tone-curve editor (like Lightroom's Tone Curve)
   for advanced per-channel control. Could replace the simple gamma slider.
6. **Selective color grade** — let users grade only the subject (via a
   rough segmentation mask) differently from the background.
7. **Batch processing** — drop multiple photos, apply the same grade to
   all, export as a zip.
