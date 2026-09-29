/**
 * GradeRenderer — a tiny WebGL1 renderer that draws a fullscreen quad with
 * the Golden Hour fragment shader applied. Designed for hot-reload of params:
 * changing a uniform re-renders in a single draw call (~sub-ms on 1400px).
 */

import { VERTEX_SHADER, FRAGMENT_SHADER } from "./shader";
import type { GradeParams } from "./types";
import { hexToRgb } from "./color";
import { buildCombinedLUT, type Curves, isAllCurvesDefault } from "./curve";

const MAX_PREVIEW_DIM = 1400;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  src: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("WebGL: failed to create shader");
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error("Shader compile error: " + info);
  }
  return shader;
}

function linkProgram(gl: WebGLRenderingContext): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = gl.createProgram();
  if (!program) throw new Error("WebGL: failed to create program");
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error("Program link error: " + info);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return program;
}

export interface Uniforms {
  image: WebGLUniformLocation | null;
  curveLUT: WebGLUniformLocation | null;
  curveEnabled: WebGLUniformLocation | null;
  resolution: WebGLUniformLocation | null;
  warmth: WebGLUniformLocation | null;
  blackPoint: WebGLUniformLocation | null;
  whitePoint: WebGLUniformLocation | null;
  gamma: WebGLUniformLocation | null;
  hiTint: WebGLUniformLocation | null;
  shTint: WebGLUniformLocation | null;
  tintStrength: WebGLUniformLocation | null;
  saturation: WebGLUniformLocation | null;
  vignette: WebGLUniformLocation | null;
  grain: WebGLUniformLocation | null;
  grainSize: WebGLUniformLocation | null;
  time: WebGLUniformLocation | null;
  showOriginal: WebGLUniformLocation | null;
}

export class GradeRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private texture: WebGLTexture | null = null;
  private curveTexture: WebGLTexture | null = null;
  private buffer: WebGLBuffer;
  private uniforms: Uniforms;
  private posLoc: number;
  /** Original image width/height (post-downscale for preview). */
  private imgW = 1;
  private imgH = 1;
  /** Whether a texture has been uploaded. */
  public hasTexture = false;
  /** Framerate cap (for grain animation). */
  private lastFrame = 0;
  private rafId: number | null = null;
  private animating = false;

  constructor(canvas: HTMLCanvasElement) {
    const gl =
      (canvas.getContext("webgl", {
        preserveDrawingBuffer: true,
        premultipliedAlpha: false,
        antialias: false,
      }) as WebGLRenderingContext | null) ||
      (canvas.getContext("experimental-webgl", {
        preserveDrawingBuffer: true,
        premultipliedAlpha: false,
        antialias: false,
      }) as WebGLRenderingContext | null);
    if (!gl) throw new Error("WebGL not supported");
    this.gl = gl;
    this.program = linkProgram(gl);
    gl.useProgram(this.program);

    // Fullscreen quad (two triangles) in 0..1 UV space.
    this.buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1,
      ]),
      gl.STATIC_DRAW
    );
    this.posLoc = gl.getAttribLocation(this.program, "a_position");
    gl.enableVertexAttribArray(this.posLoc);
    gl.vertexAttribPointer(this.posLoc, 2, gl.FLOAT, false, 0, 0);

    this.uniforms = {
      image: gl.getUniformLocation(this.program, "u_image"),
      curveLUT: gl.getUniformLocation(this.program, "u_curveLUT"),
      curveEnabled: gl.getUniformLocation(this.program, "u_curveEnabled"),
      resolution: gl.getUniformLocation(this.program, "u_resolution"),
      warmth: gl.getUniformLocation(this.program, "u_warmth"),
      blackPoint: gl.getUniformLocation(this.program, "u_blackPoint"),
      whitePoint: gl.getUniformLocation(this.program, "u_whitePoint"),
      gamma: gl.getUniformLocation(this.program, "u_gamma"),
      hiTint: gl.getUniformLocation(this.program, "u_hiTint"),
      shTint: gl.getUniformLocation(this.program, "u_shTint"),
      tintStrength: gl.getUniformLocation(this.program, "u_tintStrength"),
      saturation: gl.getUniformLocation(this.program, "u_saturation"),
      vignette: gl.getUniformLocation(this.program, "u_vignette"),
      grain: gl.getUniformLocation(this.program, "u_grain"),
      grainSize: gl.getUniformLocation(this.program, "u_grainSize"),
      time: gl.getUniformLocation(this.program, "u_time"),
      showOriginal: gl.getUniformLocation(this.program, "u_showOriginal"),
    };
    gl.uniform1i(this.uniforms.image, 0);
    gl.uniform1i(this.uniforms.curveLUT, 1); // texture unit 1

    // Initialize the curve LUT texture (256x4, identity).
    this.curveTexture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.curveTexture);
    const identity = new Uint8Array(256 * 4 * 4);
    for (let x = 0; x < 256; x++) {
      identity[x * 4 + 0] = x;
      identity[x * 4 + 1] = x;
      identity[x * 4 + 2] = x;
      identity[x * 4 + 3] = 255;
      identity[(256 + x) * 4 + 0] = x;
      identity[(512 + x) * 4 + 1] = x;
      identity[(768 + x) * 4 + 2] = x;
      identity[(256 + x) * 4 + 3] = 255;
      identity[(512 + x) * 4 + 3] = 255;
      identity[(768 + x) * 4 + 3] = 255;
    }
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      256,
      4,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      identity
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  /** Max texture size supported by this GPU — queried lazily. */
  private maxTexSize = 0;
  /** Rotation applied to the source image (0, 90, 180, 270). */
  private rotation = 0 as 0 | 90 | 180 | 270;

  /**
   * Upload an HTMLImageElement as a 2D texture, downscaled for preview.
   * The image is rotated by `rotation` degrees clockwise when drawn to the
   * offscreen canvas, so both preview and export respect orientation.
   */
  setImage(
    img: HTMLImageElement,
    maxDim = MAX_PREVIEW_DIM,
    rotation: 0 | 90 | 180 | 270 = 0
  ) {
    const gl = this.gl;
    if (!this.maxTexSize) {
      this.maxTexSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    }
    const gpuCap = Math.max(256, this.maxTexSize);
    // Compute downscaled dims preserving aspect ratio, clamped to GPU cap.
    // For 90°/270° rotations, the swapped dimensions matter for the cap.
    const srcW = rotation % 180 === 0 ? img.naturalWidth : img.naturalHeight;
    const srcH = rotation % 180 === 0 ? img.naturalHeight : img.naturalWidth;
    const longest = Math.max(srcW, srcH);
    const factor =
      longest > Math.min(maxDim, gpuCap)
        ? Math.min(maxDim, gpuCap) / longest
        : 1;
    const w = Math.max(1, Math.round(srcW * factor));
    const h = Math.max(1, Math.round(srcH * factor));
    this.imgW = w;
    this.imgH = h;
    this.rotation = rotation;

    // Use a 2D canvas to downscale + rotate (WebGL texImage2D accepts canvases).
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const ctx = off.getContext("2d", { willReadFrequently: false })!;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    // After rotating the canvas, draw the image centered on its own dims.
    const drawW = rotation % 180 === 0 ? w : h;
    const drawH = rotation % 180 === 0 ? h : w;
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    if (!this.texture) this.texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, off);
    // NPOT-safe parameters
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    this.hasTexture = true;
  }

  /**
   * Set the canvas backing store. For preview we apply DPR for crispness;
   * for export we pass dpr=1 to match the source pixel-for-pixel.
   */
  resizeCanvas(w: number, h: number, dpr = 1) {
    const canvas = this.gl.canvas as HTMLCanvasElement;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    this.gl.viewport(0, 0, canvas.width, canvas.height);
  }

  /** Current texture dims (post-downscale). */
  get dims() {
    return { w: this.imgW, h: this.imgH };
  }

  /**
   * Update the curve LUT texture from a Curves object.
   * Cheap (1024 bytes) — call whenever curves change.
   */
  updateCurves(curves: Curves) {
    const gl = this.gl;
    if (!this.curveTexture) return;
    const enabled = isAllCurvesDefault(curves) ? 0 : 1;
    const data = buildCombinedLUT(curves);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.curveTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      256,
      4,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data
    );
    gl.uniform1f(this.uniforms.curveEnabled, enabled);
  }

  /**
   * Read a downscaled snapshot of the current graded frame as RGBA pixels.
   * Used by the Histogram for pixel-perfect accuracy (replaces the old
   * 96px CPU-graded downsample). Reads from the WebGL framebuffer directly.
   *
   * Caller must ensure a fresh draw has happened before calling (the rAF
   * animation loop keeps the buffer current).
   */
  readDownscaledPixels(maxDim = 96): Uint8Array | null {
    const gl = this.gl;
    if (!this.hasTexture) return null;
    const longest = Math.max(this.imgW, this.imgH);
    const factor = longest > maxDim ? maxDim / longest : 1;
    const w = Math.max(1, Math.round(this.imgW * factor));
    const h = Math.max(1, Math.round(this.imgH * factor));
    // We can't easily downscale during readPixels — it reads at the canvas
    // backing-store resolution. Instead, read the full canvas and sample.
    // For preview canvases (≤1400px) this is fast enough.
    const cw = (this.gl.canvas as HTMLCanvasElement).width;
    const ch = (this.gl.canvas as HTMLCanvasElement).height;
    const buf = new Uint8Array(cw * ch * 4);
    gl.flush();
    gl.finish();
    gl.readPixels(0, 0, cw, ch, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    // Downsample by striding.
    const out = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      const sy = Math.floor((y / h) * ch);
      for (let x = 0; x < w; x++) {
        const sx = Math.floor((x / w) * cw);
        const srcIdx = ((ch - 1 - sy) * cw + sx) * 4; // flip Y
        const dstIdx = (y * w + x) * 4;
        out[dstIdx] = buf[srcIdx];
        out[dstIdx + 1] = buf[srcIdx + 1];
        out[dstIdx + 2] = buf[srcIdx + 2];
        out[dstIdx + 3] = 255;
      }
    }
    return out;
  }

  /**
   * Render one frame with the given params.
   * `showOriginal` short-circuits the pipeline and shows the raw image.
   */
  draw(params: GradeParams, time: number, showOriginal = false) {
    if (!this.hasTexture) return;
    const gl = this.gl;
    gl.useProgram(this.program);

    const hi = hexToRgb(params.highlightTint);
    const sh = hexToRgb(params.shadowTint);

    // Re-bind the curve texture to unit 1 (it may have been unbound).
    gl.activeTexture(gl.TEXTURE1);
    if (this.curveTexture) gl.bindTexture(gl.TEXTURE_2D, this.curveTexture);

    gl.uniform2f(this.uniforms.resolution, this.imgW, this.imgH);
    gl.uniform1f(this.uniforms.warmth, params.warmth);
    gl.uniform1f(this.uniforms.blackPoint, params.blackPoint);
    gl.uniform1f(this.uniforms.whitePoint, params.whitePoint);
    gl.uniform1f(this.uniforms.gamma, params.gamma);
    gl.uniform3f(this.uniforms.hiTint, hi.r, hi.g, hi.b);
    gl.uniform3f(this.uniforms.shTint, sh.r, sh.g, sh.b);
    gl.uniform1f(this.uniforms.tintStrength, params.tintStrength);
    gl.uniform1f(this.uniforms.saturation, params.saturation);
    gl.uniform1f(this.uniforms.vignette, params.vignette);
    gl.uniform1f(this.uniforms.grain, params.grain);
    gl.uniform1f(this.uniforms.grainSize, params.grainSize);
    gl.uniform1f(this.uniforms.time, time);
    gl.uniform1f(this.uniforms.showOriginal, showOriginal ? 1 : 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  /**
   * Start a continuous rAF loop that re-renders the grain animation.
   * Capped to ~30fps to save battery; grain shimmer at 30fps is plenty.
   */
  startAnimation(getParams: () => GradeParams, getShowOriginal: () => boolean) {
    if (this.animating) return;
    this.animating = true;
    const loop = (t: number) => {
      if (!this.animating) return;
      // ~30fps cap
      if (t - this.lastFrame >= 33) {
        this.lastFrame = t;
        this.draw(getParams(), t / 1000, getShowOriginal());
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stopAnimation() {
    this.animating = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  /** Read the current canvas as a Blob (JPEG/PNG). For full-res export. */
  async toBlob(format: "jpeg" | "png", quality = 0.92): Promise<Blob | null> {
    const canvas = this.gl.canvas as HTMLCanvasElement;
    // Force a fresh draw so the buffer is current.
    return new Promise((resolve) =>
      canvas.toBlob(
        (b) => resolve(b),
        format === "png" ? "image/png" : "image/jpeg",
        quality
      )
    );
  }

  dispose() {
    this.stopAnimation();
    const gl = this.gl;
    if (this.texture) gl.deleteTexture(this.texture);
    if (this.curveTexture) gl.deleteTexture(this.curveTexture);
    gl.deleteBuffer(this.buffer);
    gl.deleteProgram(this.program);
    this.texture = null;
    this.curveTexture = null;
    this.hasTexture = false;
  }
}

/**
 * Render the full-resolution graded image to a fresh offscreen canvas and
 * return a Blob. Used by the Download button — bypasses the preview downscale
 * so the exported file matches the original image dimensions.
 *
 * Falls back to the CPU grade path if WebGL is unavailable.
 */
export async function renderFullRes(
  img: HTMLImageElement,
  params: GradeParams,
  format: "jpeg" | "png",
  quality = 0.92,
  rotation: 0 | 90 | 180 | 270 = 0,
  curves?: Curves
): Promise<Blob> {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  // Try WebGL first (fast).
  try {
    const canvas = document.createElement("canvas");
    const renderer = new GradeRenderer(canvas);
    renderer.setImage(img, Math.max(w, h), rotation); // no downscale (within GPU cap)
    if (curves) renderer.updateCurves(curves);
    const { w: tw, h: th } = renderer.dims;
    renderer.resizeCanvas(tw, th, 1); // 1:1 backing store for export
    renderer.draw(params, Math.random() * 1000, false);
    const blob = await renderer.toBlob(format, quality);
    renderer.dispose();
    if (blob) return blob;
  } catch {
    // fall through to CPU
  }
  // CPU fallback (slow but correct).
  const outW = rotation % 180 === 0 ? w : h;
  const outH = rotation % 180 === 0 ? h : w;
  const off = document.createElement("canvas");
  off.width = outW;
  off.height = outH;
  const ctx = off.getContext("2d")!;
  ctx.save();
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
  const src = ctx.getImageData(0, 0, outW, outH);
  // Lazy import to avoid pulling into the main bundle if WebGL succeeds.
  const { gradeImageData } = await import("./cpu");
  const out = gradeImageData(src, params);
  ctx.putImageData(out, 0, 0);
  return new Promise((resolve) =>
    off.toBlob(
      (b) => resolve(b!),
      format === "png" ? "image/png" : "image/jpeg",
      quality
    )!
  );
}
