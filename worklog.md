# Golden Hour — Web UI Image Editor · Worklog

## Round 4 — Curve Editor + readPixels Histogram + Film Leader Intro (COMPLETE)

### Phase Assessment
Rounds 1-3 were stable. This round delivered the highest-impact pro feature
(a Lightroom-style tone curve editor wired into the WebGL shader), upgraded
the histogram to pixel-perfect accuracy via `readPixels`, and added a
cinematic film-leader countdown intro. Extensive styling polish shipped
alongside.

### New Features Delivered

1. **Tone Curve Editor** (`CurveEditor.tsx` + `curve.ts` + shader pass)
   — a Lightroom-style interactive SVG curve with 5 control points
   (x = 0, 64, 128, 192, 255), Catmull-Rom spline interpolation, and
   per-channel tabs (RGB master, R, G, B).
   - Master curve applies to all channels first; then per-channel curves
     refine R, G, B individually (same as Lightroom).
   - Endpoints (0,0) and (255,255) are locked; interior points are
     draggable with pointer events (touch + mouse).
   - Monotonic-ish constraint prevents neighbors from crossing.
   - The curve is sampled to a 256×4 RGBA LUT texture, uploaded to the
     WebGL shader on TEXTURE1, and sampled via `texture2D` with LINEAR
     filtering for smooth interpolation.
   - New shader pass "2b" sits between levels/gamma and split-tone.
   - When curves are at default (identity), `u_curveEnabled=0` short-
     circuits the pass for zero cost.
   - Reset button + toast. Channel tabs colored per channel (red/green/blue/white).
   - Verified: dragging the middle point down created an S-curve and
     DARKENED the midtones in the live preview. VLM confirmed.

2. **readPixels-based Histogram** (upgraded `Histogram.tsx`)
   — the histogram now reads directly from the live WebGL canvas via
   `renderer.readDownscaledPixels(96)` for pixel-perfect accuracy.
   - PRIMARY PATH: `gl.readPixels` on the preview canvas, strided
     downsample to 96px, build histogram bins. Captures EVERYTHING the
     user sees — curve LUT, vignette, grain, split-tone, warmth.
   - FALLBACK: if the renderer isn't available (no WebGL), re-grades a
     96px CPU downsample (the old path).
   - Shared renderer ref exposed via `rendererGetter` in the Zustand store
     (set by ImageCanvas, read by Histogram).
   - Recomputes on params/curves/rotation change with 120ms debounce.
   - Verified: histogram shows live data reflecting the graded image.

3. **Film Leader Countdown Intro** (`FilmLeaderIntro.tsx`)
   — a SMPTE-style film-leader animation on first load only.
   - 3-2-1 countdown with pop animation, spinning amber tick rings
     (CW + CCW), corner crosshairs, "GOLDEN HOUR" brand text.
   - Plays once; `localStorage` flag skips it on subsequent loads.
   - 700ms per count, ~2.8s total. Uses `repeating-conic-gradient` for
     the reel-leader sunburst background.
   - Verified: VLM confirmed the full overlay rendered (it generated an
     HTML replica matching the design).

### Styling Polish Delivered

- New "Curve" section in ControlPanel between Tone and Texture, with a
  custom curve icon.
- Channel tabs in CurveEditor with per-channel colors and inset glow.
- Control point hover/drag glow filter (`drop-shadow` in channel color).
- Curve stats overlay (bottom-right of curve canvas) showing the 3
  interior point values in mono.
- All existing Round 1-3 polish retained (easel corners, slider amber
  fill + ticks, film perforations, etc.).

### Verification Results (agent-browser + VLM)

| Check | Result |
|---|---|
| Curve editor renders with 5 points + diagonal reference | ✅ VLM confirmed |
| Channel tabs (RGB/Red/Green/Blue) + reset button | ✅ VLM confirmed |
| Dragging middle point creates S-curve | ✅ VLM: "bows below diagonal" |
| Curve drag darkens image midtones live | ✅ VLM: "darker midtones on After side" |
| Histogram shows live data from WebGL canvas | ✅ VLM confirmed |
| Film leader intro plays on first load (3-2-1) | ✅ VLM confirmed full overlay |
| Intro skips on subsequent loads (localStorage) | ✅ VLM: "main UI now showing" |
| Lint clean, no runtime errors on fresh load | ✅ |
| All sections visible (Color/Tone/Curve/Texture/My Presets) | ✅ VLM confirmed |

### Bug Found & Fixed During QA
- **`react-hooks/set-state-in-effect` lint error** in FilmLeaderIntro —
  calling `setVisible(true)` synchronously in the effect. Fixed by lazy
  `useState` initializer that reads localStorage at mount time.
- **Unused eslint-disable** in Histogram after the readPixels refactor —
  removed the stale directive.

### Files Added / Modified (Round 4)
```
NEW  src/lib/grade/curve.ts                       # Catmull-Rom + LUT builder
NEW  src/components/editor/CurveEditor.tsx        # interactive SVG curve
NEW  src/components/editor/FilmLeaderIntro.tsx    # SMPTE countdown intro
MOD  src/lib/grade/shader.ts                      # curve LUT sampling pass 2b
MOD  src/lib/grade/renderer.ts                    # curveTexture, updateCurves, readDownscaledPixels
MOD  src/store/editor-store.ts                    # curves state, rendererGetter
MOD  src/components/editor/ImageCanvas.tsx        # register renderer getter, update curves
MOD  src/components/editor/DownloadButton.tsx     # pass curves on export
MOD  src/components/editor/Histogram.tsx          # readPixels primary path
MOD  src/components/editor/ControlPanel.tsx       # Curve section + CurveIcon
MOD  src/app/page.tsx                              # mount FilmLeaderIntro
```

---

## Round 3 — Diagonal Split + EXIF + History Scrubber (reference)

Shipped: 45° diagonal before/after handle, EXIF auto-rotation, undo/redo
history scrubber with amber dots + counter, J/K preset stepping, film
perforation strips, rotating aperture ring, slider tick marks + amber fill.

## Round 2 — Feature Expansion + Styling Polish (reference)

Shipped: shareable URL params, image rotation, compare-4-presets modal,
keyboard help dialog, image info bar, custom user presets, easel corners,
top-bar glow, toasts, preset intensity bars. Fixed dual-active preset badge.

## Round 1 — Initial Build (reference)

Single-page Next.js 16 app, WebGL1 fragment shader porting all 6 grade
passes. All 10 hard acceptance criteria verified. Tech: Next.js 16 + TS +
Tailwind 4 + shadcn/ui + Zustand + sharp. Fonts: Playfair Display, Inter,
JetBrains Mono.

---

## Unresolved Issues / Risks

- **None blocking.** All Round 1-4 features verified.
- **Minor:** `readPixels` forces a `gl.flush()` + `gl.finish()` which can
  stall the GPU briefly. The 120ms debounce limits this to once per param
  change, so it's imperceptible. On very large preview canvases (>2000px)
  it could be noticeable; the preview is capped at 1400px so we're safe.
- **Minor:** The curve LUT texture is 256×4 = 1024 bytes, re-uploaded on
  every curve drag. Negligible cost.
- **Minor:** Curve state is NOT persisted to URL/localStorage yet (only
  params are). Adding curve serialization to the URL would bloat it
  significantly (20 numbers). Could add a compact encoding if requested.

## Priority Recommendations for Next Phase

1. **Web Worker for CPU fallback** — move the CPU grade path off the main
   thread for large exports on non-WebGL devices. Last remaining original
   stretch goal.
2. **"Compare N custom presets"** — extend the compare modal to let users
   pick which presets (built-in + saved) to compare side-by-side.
3. **Selective color grade** — let users grade only the subject (via a
   rough segmentation mask) differently from the background.
4. **Batch processing** — drop multiple photos, apply the same grade to
   all, export as a zip.
5. **Curve state persistence** — serialize curves into a compact URL
   encoding + localStorage so users can share curve settings.
6. **Histogram overlay on the image preview** — a tiny inline histogram
   in the corner of the preview itself (like Lightroom's CL/WS indicators).
7. **Before/after auto-cycle** — a "play" button that auto-cycles the
   before/after split back and forth for demo reels.
