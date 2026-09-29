# Golden Hour — Web UI Image Editor · Worklog

## Round 10 — Histogram Parade Mode + Adjustable Clipping (COMPLETE)

### Phase Assessment
Rounds 1-9 were stable. This round added DaVinci Resolve-style RGB parade
scope, adjustable clipping threshold, and refined the histogram UI.

### New Features Delivered

1. **Histogram RGB parade mode** (`Histogram.tsx`) — a DaVinci Resolve-style
   3-row stacked view showing R/G/B channels separately.
   - **Mode toggle** (overlay ↔ parade) with two small icon buttons
     (BarChart3 / Layers) next to the "Histogram" label.
   - **Overlay mode**: all 3 channels on one graph with screen blend
     (the original behavior).
   - **Parade mode**: 3 separate rows (R top, G middle, B bottom), each with
     its own filled waveform area + colored background tint.
   - Each parade row has its own zebra-stripe clipping overlay.
   - Verified: VLM confirmed "3 separate stacked rows (Red on top, Green
     in middle, Blue at bottom) each with its own filled waveform area."

2. **Adjustable clipping threshold** — a small slider at the bottom of the
   histogram lets users set the clipping level (1-20, default 5).
   - `computeClipping()` now accepts a threshold param.
   - Highlight clip: all channels ≥ (255 - threshold).
   - Shadow clip: all channels ≤ threshold.
   - The zebra-stripe overlay width on the histogram adjusts in real-time.
   - Verified: raising from 5 → 15 made the S indicator turn red/pink
     (more clipping detected at the higher threshold).

### Styling Polish Delivered

- Mode toggle with amber-tinted active state.
- Parade rows have subtle colored background tints (red/green/blue at 4% opacity).
- Filled waveform areas in parade mode (15% opacity fill + 90% stroke).
- Clip slider with amber accent + mono numeric readout.
- All previous rounds' polish retained.

### Verification Results (agent-browser + VLM)

| Check | Result |
|---|---|
| Mode toggle (overlay ↔ parade) visible | ✅ VLM confirmed |
| Overlay mode: 3 channels on one graph | ✅ VLM confirmed |
| Parade mode: 3 stacked rows (R/G/B) | ✅ VLM confirmed |
| Clip threshold slider (1-20) visible | ✅ VLM confirmed |
| Raising threshold → more clipping detected | ✅ S indicator turned red at 15 |
| Lint clean, no runtime errors | ✅ |

### Files Modified (Round 10)
```
MOD  src/components/editor/Histogram.tsx  # parade mode + adjustable clipping
```

---

## Rounds 1-9 (reference, kept for context)

- **Round 9:** Histogram clipping indicators (zebra + S/H badges), slider
  keyboard focus ring, Web Worker scaffold.
- **Round 8:** Slider value tooltips on drag, color picker viewport-edge
  detection, recipe migration, auto-cycle with diagonal mode.
- **Round 7:** Selective params persistence, hex color picker popover,
  recipe JSON export/import.
- **Round 6:** Selective color grade (luminance-mask subject isolation),
  curve keyboard nudging (↑↓ ←→).
- **Round 5:** Curve state persistence (base64 URL), auto-cycle animation,
  inline preview histogram, animated gradient title.
- **Round 4:** Tone curve editor (Catmull-Rom + LUT texture), readPixels
  histogram, film leader countdown intro.
- **Round 3:** 45° diagonal before/after handle, EXIF auto-rotation,
  undo/redo history scrubber, J/K preset stepping, film perforations.
- **Round 2:** Shareable URL params, image rotation, compare-4-presets
  modal, keyboard help dialog, image info bar, custom user presets,
  easel corners, toasts, preset intensity bars.
- **Round 1:** Initial build — WebGL1 fragment shader porting all 6 grade
  passes, all 10 hard acceptance criteria verified.

---

## Unresolved Issues / Risks

- **None blocking.** All Round 1-10 features verified.
- **Minor:** The Web Worker scaffold still delegates to synchronous fallback
  (ImageData not available in workers without OffscreenCanvas).
- **Minor:** The parade mode height is fixed at 58px (3×18 + 4 gap); could
  be responsive to the container.

## Priority Recommendations for Next Phase

1. **Full Web Worker migration** — port the CPU grade to use
   `OffscreenCanvas` + transferable `ArrayBuffer`s.
2. **Batch processing** — drop multiple photos, apply the same grade to
   all, export as a zip.
3. **Spatial subject mask** — integrate a lightweight segmentation model
   (BodyPix/MediaPipe) for true subject isolation.
4. **Recipe gallery** — a visual grid of saved recipes with thumbnails.
5. **Adjustment layers** — stack multiple grade passes as reorderable layers.
6. **Waveform monitor** — a separate scope showing the image's luminance
   waveform (like DaVinci's waveform scope).
7. **Vectorscope** — a YCbCr vectorscope showing color distribution
   (like DaVinci's vectorscope).
