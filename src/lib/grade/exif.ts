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
 *
 * If ANYTHING fails, we fall back to a plain object URL (no EXIF correction).
 * EXIF orientation is a nice-to-have, not worth blocking the upload for.
 */

export interface NormalizedImage {
  url: string;
  width: number;
  height: number;
}

/**
 * Decode a File into an orientation-corrected blob URL.
 * Falls back to the raw object URL if anything fails.
 */
export async function normalizeOrientation(file: File): Promise<NormalizedImage> {
  // Primary path: createImageBitmap with EXIF orientation.
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image" as ImageOrientation,
    } as ImageBitmapOptions);
    // Only re-encode if the bitmap has valid dimensions.
    if (bitmap.width > 0 && bitmap.height > 0) {
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.95)
      );
      if (blob) {
        return {
          url: URL.createObjectURL(blob),
          width: canvas.width,
          height: canvas.height,
        };
      }
    } else {
      bitmap.close();
    }
  } catch {
    // Fall through to the simple fallback.
  }

  // Fallback: just use the raw file URL, no EXIF correction.
  return decodeDims(file);
}

/** Decode just the dimensions using an Image element. Always works. */
async function decodeDims(file: File): Promise<NormalizedImage> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({
        url,
        width: img.naturalWidth || 1,
        height: img.naturalHeight || 1,
      });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to decode image"));
    };
    // Set a timeout in case onload never fires.
    setTimeout(() => {
      if (img.naturalWidth === 0) {
        URL.revokeObjectURL(url);
        reject(new Error("Image decode timed out"));
      }
    }, 10000);
    img.src = url;
  });
}

/** Parse the EXIF `Orientation` tag (tag 0x0112) from a JPEG byte buffer. */
export function readExifOrientation(bytes: Uint8Array): number {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return 0;
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = bytes[i + 1];
    const size = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker === 0xe1) {
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
    i += 2 + size;
  }
  return 0;
}

/** Parse the TIFF/IFD structure to find the Orientation tag (0x0112). */
function parseExifIFD(segment: Uint8Array): number {
  if (segment.length < 8) return 0;
  const bigEndian = segment[0] === 0x4d && segment[1] === 0x49;
  const littleEndian = segment[0] === 0x49 && segment[1] === 0x4d;
  if (!bigEndian && !littleEndian) return 0;
  const dv = new DataView(
    segment.buffer,
    segment.byteOffset,
    segment.byteLength
  );
  const read16 = (offset: number) =>
    bigEndian ? dv.getUint16(offset) : dv.getUint16(offset, true);
  const ifdOffset = read16(4);
  const entryCount = read16(ifdOffset);
  for (let e = 0; e < entryCount; e++) {
    const entryOffset = ifdOffset + 2 + e * 12;
    const tag = read16(entryOffset);
    if (tag === 0x0112) {
      return read16(entryOffset + 8);
    }
  }
  return 0;
}
