/**
 * Client-side image compression applied to trade screenshots BEFORE they are
 * uploaded to Cloudinary.
 *
 * Uses the browser Canvas API only - no extra dependency is introduced.
 * Chart screenshots (candles, price labels, indicators) are the main payload,
 * so the defaults are deliberately conservative:
 *   - long edge capped at 1600px (never scaled up)
 *   - WebP when the browser can encode it, otherwise PNG/JPEG
 *   - quality 0.78, reduced only while the result is above ~300 KB
 *   - quality never drops below 0.5 so labels stay readable
 */

export interface ImageCompressionOptions {
  /** Maximum width in pixels. The image is never scaled up. */
  maxWidth: number;
  /** Maximum height in pixels. The image is never scaled up. */
  maxHeight: number;
  /** Encoder quality used for the first attempt (0 - 1). */
  quality: number;
  /** Stop lowering quality once the blob is at or below this size. */
  targetBytes: number;
  /** Quality floor - keeps chart text and candles legible. */
  minQuality: number;
  /** Quality decrement applied on every retry. */
  qualityStep: number;
}

export const DEFAULT_IMAGE_COMPRESSION_OPTIONS: ImageCompressionOptions = {
  maxWidth: 1600,
  maxHeight: 1600,
  quality: 0.78,
  targetBytes: 300 * 1024,
  minQuality: 0.5,
  qualityStep: 0.08,
};

export interface CompressedImage {
  /** The file that should actually be uploaded. */
  file: File;
  originalName: string;
  originalSize: number;
  compressedSize: number;
  originalWidth: number;
  originalHeight: number;
  width: number;
  height: number;
  mimeType: string;
  /** True when a new, smaller file was produced. */
  compressed: boolean;
  /** Present when compression failed and the original file is used instead. */
  error?: string;
}

const IMAGE_TYPE = /^image\//i;
const OPAQUE_TYPES = ['image/jpeg', 'image/jpg'];

/** Human readable byte size used by the preview captions. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb >= 100 ? Math.round(kb) : kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb >= 100 ? Math.round(mb) : mb.toFixed(2)} MB`;
}

let webpSupport: boolean | null = null;

/** Cached `canvas.toDataURL('image/webp')` capability probe. */
function supportsWebp(): boolean {
  if (webpSupport !== null) return webpSupport;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    webpSupport =
      canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  } catch {
    webpSupport = false;
  }
  return webpSupport;
}

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  release?: () => void;
}

async function decode(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // fall through to the <img> decoder
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Image could not be decoded'));
      img.src = url;
    });
    if (!img.naturalWidth || !img.naturalHeight) {
      throw new Error('Image has no usable dimensions');
    }
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((blob) => resolve(blob), type, quality);
    } catch {
      resolve(null);
    }
  });
}

/**
 * White-flatten a canvas so transparent PNG/WebP screenshots do not turn
 * black when they are re-encoded as JPEG.
 */
function flattenOnWhite(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return source;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0);
  return canvas;
}

/** Encode at the configured quality, stepping down while over the target size. */
async function encodeToTarget(
  canvas: HTMLCanvasElement,
  mimeType: string,
  options: ImageCompressionOptions
): Promise<Blob | null> {
  let quality = options.quality;
  let best = await canvasToBlob(canvas, mimeType, quality);

  while (best && best.size > options.targetBytes && quality > options.minQuality) {
    const nextQuality = Math.max(options.minQuality, quality - options.qualityStep);
    if (nextQuality === quality) break;
    quality = nextQuality;
    const next = await canvasToBlob(canvas, mimeType, quality);
    // PNG ignores quality - stop as soon as it stops improving.
    if (!next || next.size >= best.size) break;
    best = next;
  }

  return best;
}

/**
 * Compress a single image file. Never rejects: on any failure the original
 * file is returned untouched and `error` explains why.
 */
export async function compressImage(
  file: File,
  partialOptions: Partial<ImageCompressionOptions> = {}
): Promise<CompressedImage> {
  const options: ImageCompressionOptions = {
    ...DEFAULT_IMAGE_COMPRESSION_OPTIONS,
    ...partialOptions,
  };

  const original: CompressedImage = {
    file,
    originalName: file.name,
    originalSize: file.size,
    compressedSize: file.size,
    originalWidth: 0,
    originalHeight: 0,
    width: 0,
    height: 0,
    mimeType: file.type || 'application/octet-stream',
    compressed: false,
  };

  // Non raster inputs (svg, heic the browser cannot decode, ...) are passed
  // through untouched so the upload flow keeps working.
  if (!IMAGE_TYPE.test(file.type || '')) {
    original.error = 'Unsupported file type - uploaded as-is.';
    return original;
  }

  let decoded: DecodedImage | undefined;
  try {
    decoded = await decode(file);

    original.originalWidth = decoded.width;
    original.originalHeight = decoded.height;
    original.width = decoded.width;
    original.height = decoded.height;

    // Never upscale: only shrink when the long edge exceeds the cap.
    const scale = Math.min(
      1,
      options.maxWidth / decoded.width,
      options.maxHeight / decoded.height
    );
    const targetWidth = Math.max(1, Math.round(decoded.width * scale));
    const targetHeight = Math.max(1, Math.round(decoded.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable');
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(decoded.source, 0, 0, targetWidth, targetHeight);

    // JPEG has no alpha channel; anything else may be transparent.
    const mayBeTransparent = !OPAQUE_TYPES.includes((file.type || '').toLowerCase());

    // WebP first (preferred output), then a universally supported fallback.
    const candidates: string[] = [];
    if (supportsWebp()) candidates.push('image/webp');
    candidates.push(mayBeTransparent ? 'image/png' : 'image/jpeg');
    if (mayBeTransparent) candidates.push('image/jpeg');

    let best: { blob: Blob; mimeType: string } | null = null;

    for (const mimeType of candidates) {
      const isJpeg = OPAQUE_TYPES.includes(mimeType);
      const candidateCanvas = isJpeg ? flattenOnWhite(canvas) : canvas;
      const blob = await encodeToTarget(candidateCanvas, mimeType, options);
      if (!blob) continue;
      if (!best || blob.size < best.blob.size) {
        best = { blob, mimeType };
      }
      // Preferred format is already inside the size budget - stop probing.
      if (best.blob.size <= options.targetBytes) break;
    }

    if (!best) {
      original.error = 'The browser could not re-encode this image.';
      return original;
    }

    // Never make the file bigger than the one the user picked.
    if (best.blob.size >= file.size) {
      return original;
    }

    original.width = targetWidth;
    original.height = targetHeight;
    original.mimeType = best.mimeType;
    original.compressed = true;
    original.compressedSize = best.blob.size;
    original.file = new File([best.blob], outputFileName(file.name, best.mimeType), {
      type: best.mimeType,
      lastModified: Date.now(),
    });

    return original;
  } catch (error) {
    original.error =
      error instanceof Error ? error.message : 'Image compression failed.';
    return original;
  } finally {
    decoded?.release?.();
  }
}

function stripExtension(name: string): string {
  const index = name.lastIndexOf('.');
  return index > 0 ? name.slice(0, index) : name;
}

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/webp': '.webp',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

/** Keeps the filename extension in step with the format we actually encoded. */
function outputFileName(name: string, mimeType: string): string {
  const extension = EXTENSION_BY_TYPE[mimeType];
  if (!extension) return name;
  const base = stripExtension(name);
  return name.slice(base.length).toLowerCase() === extension ? name : `${base}${extension}`;
}
