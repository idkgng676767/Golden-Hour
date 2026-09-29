/**
 * GradeRenderer — a tiny WebGL1 renderer that draws a fullscreen quad with
 * the Golden Hour fragment shader applied. Designed for hot-reload of params:
 * changing a uniform re-renders in a single draw call (~sub-ms on 1400px).
 */

import { VERTEX_SHADER, FRAGMENT_SHADER } from "./shader";
import type { GradeParams } from "./types";
import { hexToRgb } from "./color";

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
  }

  /** Max texture size supported by this GPU — queried lazily. */
  private maxTexSize = 0;

  /** Upload an HTMLImageElement as a 2D texture, downscaled for preview. */
  setImage(img: HTMLImageElement, maxDim = MAX_PREVIEW_DIM) {
    const gl = this.gl;
    if (!this.maxTexSize) {
      this.maxTexSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
    }
    const gpuCap = Math.max(256, this.maxTexSize);
    // Compute downscaled dims preserving aspect ratio, clamped to GPU cap.
    const longest = Math.max(img.naturalWidth, img.naturalHeight);
    const factor =
      longest > Math.min(maxDim, gpuCap)
        ? Math.min(maxDim, gpuCap) / longest
        : 1;
    const w = Math.max(1, Math.round(img.naturalWidth * factor));
    const h = Math.max(1, Math.round(img.naturalHeight * factor));
    this.imgW = w;
    this.imgH = h;

    // Use a 2D canvas to downscale (WebGL texImage2D accepts canvases directly).
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const ctx = off.getContext("2d", { willReadFrequently: false })!;
    ctx.drawImage(img, 0, 0, w, h);

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
   * Render one frame with the given params.
   * `showOriginal` short-circuits the pipeline and shows the raw image.
   */
  draw(params: GradeParams, time: number, showOriginal = false) {
    if (!this.hasTexture) return;
    const gl = this.gl;
    gl.useProgram(this.program);

    const hi = hexToRgb(params.highlightTint);
    const sh = hexToRgb(params.shadowTint);

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
    gl.deleteBuffer(this.buffer);
    gl.deleteProgram(this.program);
    this.texture = null;
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
  quality = 0.92
): Promise<Blob> {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  // Try WebGL first (fast).
  try {
    const canvas = document.createElement("canvas");
    const renderer = new GradeRenderer(canvas);
    renderer.setImage(img, Math.max(w, h)); // no downscale (within GPU cap)
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
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const ctx = off.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  const src = ctx.getImageData(0, 0, w, h);
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
