/**
 * EXIF orientation auto-rotation.
 *
 * Phone cameras (especially iOS) often embed an `Orientation` EXIF tag in
 * JPEGs. The raw pixel data is stored in the sensor's native orientation
 * (often landscape), with the tag indicating how to rotate for display.
 *
 * Modern browsers expose this via `createImageBitmap({ imageOrientation:
 * 'from-image' })`, which auto-applies the EXIF orientation. We use that
 * when available, then re-encode to a normalized blob URL so the rest of the
 * app (which trusts `naturalWidth`/`naturalHeight`) sees correctly-oriented
 * pixels.
 */

export interface NormalizedImage {
  url: string;
  width: number;
  height: number;
}

/**
 * Decode a File/Blob into an orientation-corrected blob URL.
 * Falls back to the raw object URL if EXIF parsing or bitmap creation fails.
 */
export async function normalizeOrientation(file: File): Promise<NormalizedImage> {
  try {
    // `createImageBitmap` with `from-image` honors EXIF orientation in
    // Chrome, Firefox, and Safari 14+.
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image" as ImageOrientation,
    } as ImageBitmapOptions);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    // Re-encode as JPEG to strip the EXIF orientation tag (pixels are now
    // physically rotated). Keeps the rest of the app simple.
    const blob: Blob = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.95)
    );
    return {
      url: URL.createObjectURL(blob),
      width: canvas.width,
      height: canvas.height,
    };
  } catch {
    // Fallback: read EXIF orientation manually and rotate via canvas.
    try {
      const buf = await file.arrayBuffer();
      const orientation = readExifOrientation(new Uint8Array(buf));
      if (orientation <= 1) {
        // No rotation needed — return a direct object URL.
        return await decodeDims(file);
      }
      return await applyManualRotation(file, orientation);
    } catch {
      return await decodeDims(file);
    }
  }
}

/** Decode just the dimensions using an Image element. */
async function decodeDims(file: File): Promise<NormalizedImage> {
  const url = URL.createObjectURL(file);
  const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error("decode failed"));
    img.src = url;
  });
  return { url, width: dims.w, height: dims.h };
}

/**
 * Parse the EXIF `Orientation` tag (tag 0x0112) from a JPEG byte buffer.
 * Returns 1..8, or 0 if not found / not a JPEG.
 *
 * Reference: EXIF spec, JPEG marker structure.
 */
export function readExifOrientation(bytes: Uint8Array): number {
  // JPEG SOI marker.
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return 0;
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = bytes[i + 1];
    const size = (bytes[i + 2] << 8) | bytes[i + 3];
    // APP1 marker (EXIF lives here).
    if (marker === 0xe1) {
      // Check "Exif\0\0" magic.
      const exifMagic =
        bytes[i + 4] === 0x45 &&
        bytes[i + 5] === 0x78 &&
        bytes[i + 6] === 0x69 &&
        bytes[i + 7] === 0x66 &&
        bytes[i + 8] === 0x00 &&
        bytes[i + 9] === 0x00;
      if (!exifMagic) {
        i += 2 + size;
        continue;
      }
      return parseExifIFD(bytes.slice(i + 10, i + 2 + size));
    }
    // Skip past this marker segment.
    i += 2 + size;
  }
  return 0;
}

/** Parse the TIFF/IFD structure to find the Orientation tag (0x0112). */
function parseExifIFD(segment: Uint8Array): number {
  if (segment.length < 8) return 0;
  const bigEndian = segment[0] === 0x4d && segment[1] === 0x49; // "MI" → Motorola big-endian
  const littleEndian = segment[0] === 0x49 && segment[1] === 0x4d; // "IM" → Intel little-endian
  if (!bigEndian && !littleEndian) return 0;
  const dv = new DataView(
    segment.buffer,
    segment.byteOffset,
    segment.byteLength
  );
  const read16 = (offset: number) =>
    bigEndian ? dv.getUint16(offset) : dv.getUint16(offset, true);
  const read32 = (offset: number) =>
    bigEndian ? dv.getUint32(offset) : dv.getUint32(offset, true);
  const ifdOffset = read16(4); // offset to first IFD entry (relative to TIFF header)
  const entryCount = read16(ifdOffset);
  for (let e = 0; e < entryCount; e++) {
    const entryOffset = ifdOffset + 2 + e * 12;
    const tag = read16(entryOffset);
    if (tag === 0x0112) {
      // Orientation — SHORT (type 3), count 1.
      const value = read16(entryOffset + 8);
      return value;
    }
  }
  return 0;
}

/** Apply manual canvas rotation for an EXIF orientation value 2..8. */
async function applyManualRotation(
  file: File,
  orientation: number
): Promise<NormalizedImage> {
  const url = URL.createObjectURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("decode failed"));
    i.src = url;
  });
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  // EXIF orientation transformations.
  // See: http://sylvana.net/jpegcrop/exif.html
  switch (orientation) {
    case 2: // flip horizontal
      canvas.width = w;
      canvas.height = h;
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
      break;
    case 3: // 180°
      canvas.width = w;
      canvas.height = h;
      ctx.translate(w, h);
      ctx.rotate(Math.PI);
      break;
    case 4: // flip vertical
      canvas.width = w;
      canvas.height = h;
      ctx.translate(0, h);
      ctx.scale(1, -1);
      break;
    case 5: // transpose (flip h + 90° cw)
      canvas.width = h;
      canvas.height = w;
      ctx.translate(h, 0);
      ctx.scale(-1, 1);
      ctx.rotate((90 * Math.PI) / 180);
      break;
    case 6: // 90° cw
      canvas.width = h;
      canvas.height = w;
      ctx.translate(h, 0);
      ctx.rotate((90 * Math.PI) / 180);
      break;
    case 7: // transverse (flip h + 90° ccw)
      canvas.width = h;
      canvas.height = w;
      ctx.translate(h, w);
      ctx.scale(-1, 1);
      ctx.rotate((-90 * Math.PI) / 180);
      break;
    case 8: // 90° ccw
      canvas.width = h;
      canvas.height = w;
      ctx.translate(0, w);
      ctx.rotate((-90 * Math.PI) / 180);
      break;
    default:
      canvas.width = w;
      canvas.height = h;
  }
  ctx.drawImage(img, 0, 0, w, h);
  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.95)
  );
  return {
    url: URL.createObjectURL(blob),
    width: canvas.width,
    height: canvas.height,
  };
}
