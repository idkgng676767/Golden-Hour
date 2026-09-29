# Golden Hour — Web UI Image Editor · Worklog

## Round 6 — Selective Color Grade + Curve Keyboard Nudging (COMPLETE)

### Phase Assessment
Rounds 1-5 were stable. This round delivered a major pro feature (selective
color grade with subject isolation) plus curve keyboard nudging for precise
editing.

### New Features Delivered

1. **Selective color grade** (`SelectiveGradePanel.tsx` + shader pass 4b +
   `SelectiveParams` type) — a luminance-band subject isolation mask that
   applies a secondary grade to the subject and a different grade to the
   background.
   - **Subject grade**: extra warmth + saturation lift (makes skin tones pop).
   - **Background grade**: darken + desaturate (mutes distractions).
   - **Dual-thumb luminance band slider** — user sets [low, high] thresholds
     defining the subject's luminance range. Smooth `smoothstep` mask with
     soft edges prevents banding.
   - **Enable/disable toggle** + reset button.
   - New shader pass "4b" sits between saturation and vignette. Zero cost
     when disabled (`u_selectiveEnabled=0`).
   - 8 new uniforms: selectiveEnabled, selectiveStrength, subjectLumaLow/High,
     subjectWarmth/Saturation, bgDarken/Desaturate.
   - Subject sub-panel (amber-tinted) + Background sub-panel (teal-tinted)
     visually distinguish the two grade targets.
   - Verified: VLM confirmed warmer subject + darker/muted background when
     enabled.

2. **Tone curve keyboard nudging** (`CurveEditor.tsx`) — arrow keys nudge
   the selected control point for precise editing.
   - **Click** a control point to select it (animated dashed selection ring).
   - **↑/↓** nudge the selected point's Y value by 0.01.
   - **←/→** switch between control points.
   - **Esc** deselects.
   - Selection ring uses SVG `animateTransform` for a slow 4s rotation.
   - Updated hint text with `<kbd>` chips.
   - Verified: cy changed from 110 → 116.6 after 3 ArrowDown presses.

### Styling Polish Delivered

- New "Selective" section in ControlPanel with a mask icon.
- Subject sub-panel: amber-tinted border + background.
- Background sub-panel: teal-tinted border + background (#5b8fa3 accent).
- Dual-thumb range slider with amber fill between thumbs.
- Curve control point selection ring (animated dashed circle).
- Curve hint text with styled `<kbd>` keyboard chips.
- Updated KeyboardHelpDialog with 2 new entries (↑↓ nudge, ←→ switch).

### Verification Results (agent-browser + VLM)

| Check | Result |
|---|---|
| Selective section renders with toggle + dual-thumb slider | ✅ VLM confirmed |
| Enable toggle switches to amber "Enabled" | ✅ VLM confirmed |
| Subject/Background sub-panels visible when enabled | ✅ VLM confirmed |
| Image shows warmer subject + darker background | ✅ VLM confirmed |
| Curve click selects point (1 selection ring) | ✅ verified |
| ArrowDown nudges point (cy 110→116.6) | ✅ verified |
| All 6 sections visible (Color/Tone/Curve/Selective/Texture/My Presets) | ✅ VLM confirmed |
| Lint clean, no runtime errors | ✅ |

### Files Added / Modified (Round 6)
```
NEW  src/components/editor/SelectiveGradePanel.tsx  # subject isolation UI
MOD  src/lib/grade/types.ts                        # SelectiveParams interface
MOD  src/lib/grade/defaults.ts                     # DEFAULT_SELECTIVE
MOD  src/lib/grade/shader.ts                       # pass 4b selective grade
MOD  src/lib/grade/renderer.ts                     # selective uniforms + draw
MOD  src/store/editor-store.ts                     # selective state + actions
MOD  src/components/editor/ImageCanvas.tsx         # pass selective to draw/anim
MOD  src/components/editor/DownloadButton.tsx      # pass selective on export
MOD  src/components/editor/ControlPanel.tsx        # Selective section + MaskIcon
MOD  src/components/editor/CurveEditor.tsx         # selection + keyboard nudging
MOD  src/components/editor/KeyboardHelpDialog.tsx  # ↑↓ ←→ entries
```

---

## Rounds 1-5 (reference, kept for context)

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

- **None blocking.** All Round 1-6 features verified.
- **Minor:** The selective grade's luminance mask is a simple global
  threshold, not a true spatial segmentation. It works well for portraits
  with clear subject/background luminance separation but won't isolate
  subjects that share luminance with their background. A true ML-based
  segmentation (e.g. BodyPix) would be more robust but adds significant
  bundle size.
- **Minor:** Selective params are NOT persisted to URL/localStorage yet
  (only params + curves are). Could add `sel=` encoding if requested.
- **Minor:** The dual-thumb range slider uses two overlapping native range
  inputs with z-index tricks. Works in Chrome/Firefox/Safari but the thumb
  hit areas can overlap at extreme values.

## Priority Recommendations for Next Phase

1. **Web Worker for CPU fallback** — move the CPU grade path off the main
   thread for large exports on non-WebGL devices. Last remaining original
   stretch goal.
2. **Selective params persistence** — serialize selective params into the
   URL + localStorage so they're shareable.
3. **Batch processing** — drop multiple photos, apply the same grade to
   all, export as a zip.
4. **Export history as a recipe** — save the full edit history (params +
   curves + rotation + selective) as a shareable "recipe" JSON.
5. **Before/after auto-cycle with diagonal mode** — make the auto-cycle
   work with the 45° diagonal split too.
6. **Spatial subject mask** — integrate a lightweight segmentation model
   (BodyPix/MediaPipe) for true subject isolation that doesn't rely on
   luminance.
7. **Color picker with hex input** — let users type a hex code directly
   instead of only using the native picker.
