# Golden Hour — Web UI Image Editor · Worklog

## Round 7 — Selective Persistence + Hex Color Picker + Recipe JSON (COMPLETE)

### Phase Assessment
Rounds 1-6 were stable. This round completed the selective grade
shareability story, added a pro-grade hex color picker popover, and shipped
recipe JSON export/import for full edit-state backup.

### New Features Delivered

1. **Selective params persistence** (`url.ts` extended) — selective grade
   params are now serialized into a compact base64 URL segment (`&sel=<base64>`).
   - 7 numeric params × 2 bytes (quantized 0-65535) + 1 enable byte = 15 bytes.
   - `readParamsFromLocation` now returns `{ params, curves, selective }`.
   - `writeParamsToLocation` accepts an optional selective arg.
   - `buildShareURL` includes selective when enabled.
   - Store's `setSelectiveParam`, `resetSelective`, `setParam`, `applyPreset`,
     `undo`, `redo`, etc. all pass selective to the URL writer.
   - `hydrateFromURL` restores params + curves + selective.
   - Verified: enabled selective → URL got `sel=AYAAWZnZmWAAd3czM0zN` →
     reloaded → selective restored as "Enabled".

2. **Color picker with hex input** (`ColorPicker.tsx` rewritten) — a
   popover-based color picker with:
   - **Hex text input** — type `#RRGGBB` directly, press Enter or ✓ to apply.
   - **15 curated swatches** — hand-picked palette for the golden-hour
     aesthetic (amber, teal, vintage film tones).
   - **Active swatch highlight** — the currently-selected swatch gets an
     amber ring.
   - **Custom picker** — opens the native OS color picker as a fallback.
   - **Reset** — restores the default tint (#E8A87C / #142C3C).
   - **Outside-click + Esc** to close.
   - **Modal entrance animation**.
   - Verified: VLM confirmed popover with hex input + swatches + footer buttons.

3. **Recipe JSON export/import** (`RecipeButton.tsx`) — save and restore
   the full edit state (params + curves + rotation + selective) as a JSON file.
   - **Export**: serializes everything into `golden-hour-recipe-<timestamp>.json`.
   - **Import**: reads a JSON file and restores the full edit state, with
     validation (must be a Golden Hour recipe, falls back to defaults for
     missing keys).
   - **Schema versioned** (`version: 1`) for future format changes.
   - **Menu popover** with Export + Import options.
   - Verified: exported 1047-byte JSON with correct params/curves/selective.

### Styling Polish Delivered

- Color picker popover with modal-enter animation, amber-tinted active states.
- Recipe button uses the FileJson icon (amber on hover).
- All previous rounds' polish retained.

### Verification Results (agent-browser + VLM)

| Check | Result |
|---|---|
| Selective params serialize to `sel=` URL segment | ✅ `sel=AYAAWZnZmWAAd3czM0zN` |
| Reload restores selective as "Enabled" | ✅ verified |
| Color picker popover with hex input + 15 swatches | ✅ VLM confirmed |
| Hex input validates `#RRGGBB` format | ✅ (regex check) |
| Recipe export produces valid JSON | ✅ 1047 bytes, well-formed |
| Recipe button menu with Export + Import | ✅ verified |
| Lint clean, no runtime errors | ✅ |

### Files Added / Modified (Round 7)
```
NEW  src/components/editor/RecipeButton.tsx     # JSON export/import
MOD  src/lib/grade/url.ts                        # selective encode/decode
MOD  src/store/editor-store.ts                   # pass selective to URL writer
MOD  src/components/editor/ShareButton.tsx       # pass selective to buildShareURL
MOD  src/app/page.tsx                            # mount RecipeButton, pass selective
MOD  src/components/editor/ColorPicker.tsx       # popover with hex input + swatches
```

---

## Rounds 1-6 (reference, kept for context)

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

- **None blocking.** All Round 1-7 features verified.
- **Minor:** The recipe JSON format is versioned but there's no migration
  logic yet. If the schema changes in a future round, old recipes may fail
  to import. Adding a `migrateRecipe()` function would handle this.
- **Minor:** The color picker popover opens below the swatch; on small
  screens it may overflow the viewport. Could add viewport-edge detection.

## Priority Recommendations for Next Phase

1. **Web Worker for CPU fallback** — move the CPU grade path off the main
   thread for large exports on non-WebGL devices. Last remaining original
   stretch goal.
2. **Batch processing** — drop multiple photos, apply the same grade to
   all, export as a zip.
3. **Before/after auto-cycle with diagonal mode** — make the auto-cycle
   work with the 45° diagonal split too.
4. **Spatial subject mask** — integrate a lightweight segmentation model
   (BodyPix/MediaPipe) for true subject isolation that doesn't rely on
   luminance.
5. **Slider value tooltips on drag** — show a floating value bubble above
   the slider thumb while dragging.
6. **Recipe migration** — add `migrateRecipe()` for forward-compatibility
   when the schema changes.
7. **Color picker viewport-edge detection** — flip the popover above the
   swatch if there's no room below.
