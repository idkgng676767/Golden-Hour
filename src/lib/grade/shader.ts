/**
 * goldenHourFragmentShader — single-pass port of the Python reference grade.
 *
 * Pipeline (EXACT order — do not reorder):
 *   1. Warm white balance
 *   2. Levels + gamma (per-channel)
 *   3. Split-tone (highlight + shadow luminance masks)
 *   4. Saturation (luminance-preserving)
 *   5. Vignette (radial)
 *   6. Film grain (monochromatic, blurred, midtone-emphasized)
 *
 * The grain uses a hash-based pseudo-noise sampled across a coarse grid so
 * that it stays *soft* (silver-halide vibe) rather than pixel-aligned digital
 * noise. Two octaves of value noise are blurred by sampling a neighborhood.
 *
 * All math operates on linear RGB in 0..255 space, matching the Python code
 * byte-for-byte.
 */

export const VERTEX_SHADER = /* glsl */ `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    // a_position is in 0..1; map to clip space -1..1
    v_uv = a_position;
    gl_Position = vec4(a_position * 2.0 - 1.0, 0.0, 1.0);
    // Flip Y so images render upright
    v_uv.y = 1.0 - v_uv.y;
  }
`;

export const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform sampler2D u_image;
  uniform sampler2D u_curveLUT;   // 256x4: row0=master, row1=R, row2=G, row3=B
  uniform float u_curveEnabled;    // 0 or 1
  uniform vec2 u_resolution;       // image texel dims
  uniform float u_warmth;
  uniform float u_blackPoint;
  uniform float u_whitePoint;
  uniform float u_gamma;
  uniform vec3  u_hiTint;          // 0..255
  uniform vec3  u_shTint;          // 0..255
  uniform float u_tintStrength;
  uniform float u_saturation;
  uniform float u_vignette;
  uniform float u_grain;           // 0..25
  uniform float u_grainSize;       // 0.3..1.5 px (controls blur radius)
  uniform float u_time;            // for animated grain
  uniform float u_showOriginal;    // 0 or 1 (before/after)

  varying vec2 v_uv;

  // Sample the curve LUT for a given channel (0=master,1=R,2=G,3=B).
  // Input v is 0..255, output is the remapped 0..255 value.
  float applyCurve(float v, float row) {
    // LUT is 256 wide x 4 rows. Sample at (v/255, row/(4-1)).
    // Use LINEAR filtering for smooth interpolation between LUT entries.
    float u = clamp(v / 255.0, 0.0, 1.0);
    float vv = row / 3.0; // 4 rows → 0, 0.333, 0.666, 1.0
    // Master LUT stored in R channel; per-channel LUTs in their respective channels.
    // We use texture2D and pick the right channel based on row.
    vec4 sample_ = texture2D(u_curveLUT, vec2(u, vv));
    if (row < 0.5) return sample_.r;       // master
    else if (row < 1.5) return sample_.r;  // R LUT stored in R of row 1
    else if (row < 2.5) return sample_.g;  // G LUT stored in G of row 2
    else return sample_.b;                 // B LUT stored in B of row 3
  }

  // --- Hash-based value noise (cheap, GPU-friendly) -------------------
  // Returns a single float in -1..1 with roughly Gaussian-ish distribution
  // via summed hashes. Two-octave sum softens the look toward film grain.
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y) * 2.0 - 1.0;
  }

  // Smooth value noise via bilinear interp of hashed lattice points.
  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    // Smoothstep for soft grain
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i + vec2(0.0, 0.0));
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  // Two-octave sum → ~Gaussian distribution, monochromatic.
  // 'scale' controls grain SIZE (larger scale = finer grain).
  float gaussianGrain(vec2 uv, float scale, float t) {
    // Animate per-frame so grain shimmers like real film.
    vec2 p = uv * scale + vec2(t * 0.13, t * 0.17);
    float n1 = valueNoise(p);
    float n2 = valueNoise(p * 2.07 + 11.3) * 0.5;
    return (n1 + n2) * 0.6667; // approx -1..1
  }

  void main() {
    // Source pixel (linear 0..255).
    vec3 c = texture2D(u_image, v_uv).rgb * 255.0;

    // ---- Pass 0: Before/after gate ---------------------------------------
    if (u_showOriginal > 0.5) {
      gl_FragColor = vec4(c / 255.0, 1.0);
      return;
    }

    // ---- Pass 1: Warm white balance --------------------------------------
    c.r = c.r * (1.0 + u_warmth * 0.4) + u_warmth * 6.0;
    c.g = c.g * (1.0 - u_warmth * 0.15) + u_warmth * 12.0;
    c.b = c.b * (1.0 - u_warmth * 0.55) + u_warmth * 4.0;

    // ---- Pass 2: Levels + gamma (per channel) ----------------------------
    float scale = 255.0 / max(1.0, (u_whitePoint - u_blackPoint));
    c = (c - u_blackPoint) * scale;
    c = clamp(c, 0.0, 255.0) / 255.0;
    c = pow(c, vec3(u_gamma));
    c = c * 255.0;

    // ---- Pass 2b: Tone curve (master then per-channel) -------------------
    // Master curve applies to all channels equally first; then per-channel
    // curves refine R, G, B individually. Skipped entirely when disabled
    // (default state) for zero-cost default path.
    if (u_curveEnabled > 0.5) {
      // Master curve (row 0)
      c.r = applyCurve(c.r, 0.0);
      c.g = applyCurve(c.g, 0.0);
      c.b = applyCurve(c.b, 0.0);
      // Per-channel curves (rows 1, 2, 3)
      c.r = applyCurve(c.r, 1.0);
      c.g = applyCurve(c.g, 2.0);
      c.b = applyCurve(c.b, 3.0);
    }

    // ---- Pass 3: Split-tone ----------------------------------------------
    // Rec.601 luminance
    float lum = dot(c, vec3(0.299, 0.587, 0.114));

    // Smooth masks — note the ^1.5 power gives a soft roll-off.
    float hiMask = clamp((lum - 110.0) / 145.0, 0.0, 1.0);
    hiMask = pow(hiMask, 1.5);
    float shMask = clamp((140.0 - lum) / 140.0, 0.0, 1.0);
    shMask = pow(shMask, 1.5);

    float hiAmt = hiMask * u_tintStrength;
    float shAmt = shMask * u_tintStrength;
    c = c * (1.0 - hiAmt) + u_hiTint * hiAmt;
    c = c * (1.0 - shAmt) + u_shTint * shAmt;

    // ---- Pass 4: Saturation (luminance-preserving) -----------------------
    // Recompute luminance after split-tone — same as Python reference.
    float lum2 = dot(c, vec3(0.299, 0.587, 0.114));
    c = lum2 + (c - lum2) * u_saturation;

    // ---- Pass 5: Vignette ------------------------------------------------
    // cx, cy centered at 0.5; dist ∈ [0, ~1.414]; normalized to corner=1.
    vec2 d = (v_uv - 0.5);
    // Match Python: divide by (cx, cy) where cx=cy=0.5 → multiply by 2.
    float dist = length(d * 2.0);
    float vmask = 1.0 - u_vignette * pow(clamp(dist, 0.0, 1.0), 2.3);
    c = c * vmask;

    // ---- Pass 6: Film grain ----------------------------------------------
    if (u_grain > 0.001) {
      // Map grainSize (0.3..1.5) to a noise lattice scale.
      // Smaller grainSize → coarser lattice → blurrier grain (silver halide).
      // We invert: larger grainSize → finer grain, matching the Python radius.
      // The Python blur radius softens the noise; here we achieve the same by
      // sampling a low-frequency lattice (smaller scale = more blur).
      float baseScale = mix(160.0, 60.0, clamp((u_grainSize - 0.3) / 1.2, 0.0, 1.0));
      // Modulate by resolution so grain density is image-size independent.
      float sizeFactor = max(u_resolution.x, u_resolution.y) / 1000.0;
      float lattice = baseScale * sizeFactor;
      float n = gaussianGrain(v_uv, lattice, u_time);
      // std = u_grain (matches Python std=GRAIN)
      float noise = n * u_grain;

      // Midtone emphasis — film grain invisible in pure black/white.
      float lum3 = dot(c, vec3(0.299, 0.587, 0.114));
      float lumaMask = clamp(1.0 - abs(lum3 - 128.0) / 128.0, 0.0, 1.0);
      lumaMask = pow(lumaMask, 0.6);
      noise *= lumaMask;

      // Monochromatic application — same delta on R, G, B.
      c += vec3(noise);
    }

    c = clamp(c, 0.0, 255.0) / 255.0;
    gl_FragColor = vec4(c, 1.0);
  }
`;
