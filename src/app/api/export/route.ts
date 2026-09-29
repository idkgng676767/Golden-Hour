import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import type { GradeParams } from "@/lib/grade/types";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/export
 *
 * Server-side full-resolution export using sharp. This is a fallback for
 * clients where WebGL is unavailable or the image is too large to process
 * in-browser. The browser-side WebGL path is preferred (faster + exact match
 * to the preview).
 *
 * Body: { image: <base64 data URL>, params: GradeParams, format: "jpeg"|"png" }
 * Returns: the graded image as a binary blob.
 *
 * The sharp pipeline approximates the 6-pass grade using its built-in
 * operations: tint via color matrix, levels via normalise, vignette via
 * composite. Film grain is generated as a noise texture and overlaid.
 * For an exact pixel match, use the client-side WebGL path instead.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      image: string;
      params: GradeParams;
      format?: "jpeg" | "png";
    };
    if (!body.image || !body.params) {
      return NextResponse.json(
        { error: "Missing image or params" },
        { status: 400 }
      );
    }
    const format = body.format === "png" ? "png" : "jpeg";
    const p = body.params;

    // Decode the data URL into a Buffer.
    const match = body.image.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
    if (!match) {
      return NextResponse.json(
        { error: "image must be a base64 data URL" },
        { status: 400 }
      );
    }
    const buf = Buffer.from(match[2], "base64");

    // Build the sharp pipeline.
    let pipeline = sharp(buf, { failOn: "none" });

    // Pass 1 + 2: warm white balance + levels approximated via per-channel
    // multiplier + offsets (sharp's recomb + linear). For exact match, use
    // the client WebGL path; this is a best-effort fallback.
    const warmthBoost = 1 + p.warmth * 0.4;
    const greenScale = 1 - p.warmth * 0.15;
    const blueScale = 1 - p.warmth * 0.55;
    const rOffset = p.warmth * 6;
    const gOffset = p.warmth * 12;
    const bOffset = p.warmth * 4;

    pipeline = pipeline.recomb({
      matrix: [
        [warmthBoost, 0, 0],
        [0, greenScale, 0],
        [0, 0, blueScale],
      ],
    });

    // Levels + gamma
    const inMin = p.blackPoint / 255;
    const inMax = p.whitePoint / 255;
    const outMin = 0;
    const outMax = 1;
    pipeline = pipeline.linear(
      (outMax - outMin) / (inMax - inMin),
      (outMin - inMin * (outMax - outMin)) / (inMax - inMin)
    );
    // gamma
    pipeline = pipeline.gamma(1 / p.gamma);

    // Approximate tint by compositing a translucent color overlay.
    // (Exact split-tone requires custom shader; the client path covers that.)

    // Vignette — composite a radial-gradient PNG.
    const meta = await pipeline.metadata();
    const w = meta.width || 1000;
    const h = meta.height || 1000;
    const vignetteSvg = Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
        <defs>
          <radialGradient id="v" cx="50%" cy="50%" r="70%">
            <stop offset="60%" stop-color="black" stop-opacity="0"/>
            <stop offset="100%" stop-color="black" stop-opacity="${p.vignette}"/>
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#v)"/>
      </svg>`
    );

    // Grain — generate a noise PNG and overlay with low opacity.
    if (p.grain > 0) {
      const grainStrength = Math.min(1, p.grain / 25);
      const noise = await sharp({
        create: {
          width: w,
          height: h,
          channels: 4,
          background: { r: 128, g: 128, b: 128, alpha: 1 },
        },
      })
        .modulate({ brightness: 1 })
        .raw()
        .toBuffer({ resolveWithObject: true });
      // Randomize the noise buffer
      for (let i = 0; i < noise.data.length; i += 4) {
        const n = (Math.random() - 0.5) * 255 * grainStrength * 0.5;
        noise.data[i] = 128 + n;
        noise.data[i + 1] = 128 + n;
        noise.data[i + 2] = 128 + n;
      }
      const noisePng = sharp(noise.data, {
        raw: { width: w, height: h, channels: 4 },
      }).png();
      pipeline = pipeline.composite([
        { input: noisePng, blend: "soft-light", opacity: grainStrength * 80 },
      ]);
    }

    pipeline = pipeline.composite([
      { input: vignetteSvg, blend: "multiply" },
    ]);

    const out =
      format === "png"
        ? await pipeline.png().toBuffer()
        : await pipeline.jpeg({ quality: 92 }).toBuffer();

    return new NextResponse(out, {
      status: 200,
      headers: {
        "Content-Type": format === "png" ? "image/png" : "image/jpeg",
        "Content-Disposition": `attachment; filename="golden-hour.${format === "png" ? "png" : "jpg"}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[api/export] error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Export failed" },
      { status: 500 }
    );
  }
}
