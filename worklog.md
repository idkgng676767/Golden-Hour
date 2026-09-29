# Golden Hour — Web UI Image Editor · Worklog

## Round 1 — Initial Production Build (COMPLETE)

Single-page Next.js 16 app that ports a cinematic 6-pass color grade (warm
white balance → levels/gamma → split-tone → saturation → vignette → film
grain) into a real-time WebGL fragment shader. Verified end-to-end against
all 10 hard acceptance criteria. See Round 1 entry below for details.

---

## Round 2 — Feature Expansion + Styling Polish (COMPLETE)

### Phase Assessment
Round 1 was stable (clean lint, no runtime errors, all acceptance criteria
VLM-verified). This round focused on the mandatory goals: **add features**
and **improve styling**, drawing from the stretch-goal list plus new
darkroom-flavored UX.

### New Features Delivered

1. **Shareable URL params** (`src/lib/grade/url.ts`) — all 11 params encoded
   into a compact URL hash (`#w=0.22&ht=E8A87C&st=142C3C&ts=0.45&sat=1.15&bp=14&wp=240&g=0.95&v=0.40&gr=12&gs=0.6`).
   - Hydration order: URL hash → localStorage → defaults.
   - `ShareButton` copies the full URL to clipboard with a sonner toast.
   - URL sync is live: every slider/preset change rewrites the hash via
     `history.replaceState` (no back-button pollution).
   - Verified: clipboard contains the correct encoded URL.

2. **Image rotation** (0/90/180/270°) — baked into the WebGL texture upload
   via a canvas 2D rotate, so both preview and full-res export honor it.
   - `R` key shortcut + info-bar rotate button.
   - Info bar shows `↻90°` indicator when rotated.
   - Verified: portrait rendered sideways after click.

3. **Compare-4-presets grid modal** (`ComparePresetsModal.tsx`) — full-screen
   2×2 grid, each tile an independent WebGL canvas rendering the current
   image with one preset. rAF-animated grain. Click a tile to apply.
   - `C` key shortcut + info-bar grid button.
   - Active preset highlighted with amber ring + "Active" badge.
   - Verified: 4 tiles render with visibly different grades; Max shows
     warmer/more vignetted than Subtle.

4. **Keyboard help dialog** (`KeyboardHelpDialog.tsx`) — `?` opens a polished
   overlay listing all 9 shortcuts with styled `<kbd>` chips.
   - Verified: all shortcuts listed correctly.

5. **Image info bar** (`ImageInfoBar.tsx`) — slim header above the preview
   showing filename, dimensions (rotation-aware), format, size, aspect ratio
   (reduced fraction), plus rotate/compare/help icon buttons.

6. **Custom user presets** (`CustomPresetSave.tsx`) — save the current params
   as a named preset, persisted to localStorage. Up to 12 presets. Apply on
   click, delete on hover. Shows W/G param summary + active highlight.
   - Wired into ControlPanel as a "My Presets" section.

### Styling Polish Delivered

- **Film-frame easel corner marks** — 4 amber L-shaped brackets framing the
  image preview (darkroom easel vibe). Verified visible in all 4 corners.
- **Top-bar amber glow line** — gradient underline beneath the header.
- **Slider thumb hover glow** — 100ms scale 1.15 + amber ring on hover/active.
- **Slider range fill** — amber gradient instead of default primary.
- **"Developing" shimmer** utility class (`.shimmer`) for loading states.
- **Card sheen sweep** (`.card-sheen`) — subtle diagonal light sweep on hover.
- **Preset chip intensity bars** — animated bottom bar whose width reflects
  the preset's weighted intensity score (warmth/grain/vignette/tint).
- **Pulsing amber dot** next to "Develop" panel header (live/active indicator).
- **Sonner toaster** — themed toasts for share/export/preset actions with
  amber-tinted borders + blur backdrop.
- **Modal entrance animation** (`.modal-enter`) — fade + translateY.
- **Focus ring polish** — amber outline on all focusable elements.
- **Custom toast styling overrides** for `[data-sonner-toast]`.

### Bug Found & Fixed During QA
- **Dual "Active" preset badge** — Default and Reset presets share identical
  param values, so both highlighted as active in the Compare modal and
  PresetButtons. Fixed `matchesPreset()` logic so "reset" only shows active
  when no named preset matches. VLM-verified: now only one badge shows.

### Verification Results (agent-browser + VLM)

| Check | Result |
|---|---|
| Share button copies encoded URL to clipboard | ✅ verified |
| URL hash updates live on preset/slider change | ✅ `#w=0.32&...` after Max |
| Rotate button rotates image + shows `↻90°` | ✅ VLM confirmed sideways |
| Compare modal: 2×2 grid, 4 distinct grades | ✅ VLM confirmed |
| Compare modal: only 1 Active badge (bug fix) | ✅ VLM: "1 tile. Max" |
| Help dialog (`?`) lists all 9 shortcuts | ✅ VLM confirmed |
| Info bar: filename, dims, format, size, ratio | ✅ VLM confirmed |
| Easel corner marks in all 4 corners | ✅ VLM confirmed |
| Custom preset save ("Test Sunset") persists | ✅ VLM confirmed |
| Mobile 390px layout, no h-scroll | ✅ VLM confirmed |
| Lint clean, no runtime errors | ✅ |

### Files Added / Modified (Round 2)
```
NEW  src/lib/grade/url.ts                          # URL param encode/decode
NEW  src/components/editor/ShareButton.tsx
NEW  src/components/editor/ComparePresetsModal.tsx
NEW  src/components/editor/KeyboardHelpDialog.tsx
NEW  src/components/editor/ImageInfoBar.tsx
NEW  src/components/editor/CustomPresetSave.tsx
MOD  src/store/editor-store.ts                     # rotation, customPresets, modals, urlSync
MOD  src/lib/grade/renderer.ts                     # rotation support in setImage + renderFullRes
MOD  src/components/editor/ImageCanvas.tsx         # pass rotation to renderer
MOD  src/components/editor/DownloadButton.tsx      # pass rotation, toast feedback
MOD  src/components/editor/ControlPanel.tsx        # My Presets section
MOD  src/components/editor/PresetButtons.tsx       # intensity bars + dual-active fix
MOD  src/components/editor/UploadZone.tsx          # capture file type/size
MOD  src/app/page.tsx                              # wire all new components + shortcuts
MOD  src/app/globals.css                           # easel corners, glow, shimmer, slider, toasts
```

## Round 1 — Initial Build (reference, kept for context)

### Tech
- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + shadcn/ui
- WebGL1 fragment shader (single draw call, all 6 passes)
- Zustand for params/image/history, persisted to localStorage
- sharp server route at `/api/export` as fallback exporter
- Fonts: Playfair Display (serif), Inter (body), JetBrains Mono (numeric)

### Original 10 Acceptance Criteria — all verified
Drag-drop upload, sub-50ms slider updates, smooth before/after, full-res
download, polished VSCO/Darkroom aesthetic, mobile layout, 11 params + 4
presets, dark amber/teal palette, fine monochromatic film grain, teal
split-tone shadows.

## Unresolved Issues / Risks

- **None blocking.** All Round 1 + Round 2 features verified.
- **Minor:** The `/api/export` sharp route remains an *approximation* of the
  grade (sharp can't do the exact split-tone math). The browser-side WebGL
  `renderFullRes()` path is the default and is pixel-accurate. The sharp
  route is a fallback only.
- **Minor:** Compare modal tiles each spin their own WebGL context (4 total
  while open). On low-end devices this could be heavy; contexts are disposed
  on unmount. Could be optimized to a single shared context if needed.
- **Minor:** Custom presets use `JSON.stringify` for equality checks, which
  is O(n) but n=11 so negligible.

## Priority Recommendations for Next Phase

1. **45° diagonal before/after handle** (Darkroom-style) — last remaining
   stretch goal from the original spec.
2. **readPixels-based histogram** — read directly from the WebGL canvas for
   pixel-perfect accuracy instead of the current 96px CPU-graded downsample.
3. **Web Worker for CPU fallback** — move the CPU grade path off the main
   thread for large exports on non-WebGL devices.
4. **Exif orientation auto-rotation** — read JPEG EXIF orientation tag on
   upload so phone photos display correctly without manual rotate.
5. **"Compare 4 presets" → "Compare N custom presets"** — extend the modal
   to let users pick which presets (built-in + saved) to compare side-by-side.
6. **Undo/redo history visualization** — a tiny scrubber showing how many
   steps back/forward are available.
7. **Keyboard `J`/`K` to step through custom presets** like a film contact
   sheet.
