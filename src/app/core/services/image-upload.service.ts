import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  CompressedImage,
  compressImage,
  ImageCompressionOptions,
} from '../utils/image-compression.util';

/** A file the user picked, already compressed, ready to preview and upload. */
export interface PendingImage {
  file: File;
  /** Data URL used for the thumbnail shown before saving. */
  previewUrl: string;
  name: string;
  originalSize: number;
  compressedSize: number;
  compressed: boolean;
  /** Present when compression could not run and the original file is used. */
  compressionError?: string;
}

export interface PreparedImages {
  images: PendingImage[];
  /** Human readable compression problems, for the notification service. */
  errors: string[];
}

/**
 * The single Cloudinary integration used by every trade form.
 * Cloud name and upload preset are exactly the ones already in use - this
 * service only centralises the call so forms do not duplicate it.
 */
@Injectable({ providedIn: 'root' })
export class ImageUploadService {
  private readonly http = inject(HttpClient);

  private readonly uploadUrl =
    'https://api.cloudinary.com/v1_1/dytjlbf1c/image/upload';
  private readonly uploadPreset = 'trade-journal';

  /** Compress one file. Never rejects - failures fall back to the original. */
  compress(
    file: File,
    options: Partial<ImageCompressionOptions> = {}
  ): Promise<CompressedImage> {
    return compressImage(file, options);
  }

  /**
   * Compress a batch (order preserved) and build the preview data URLs.
   * Compression failures are reported through `errors` and the original file
   * is kept, so the user can still upload it.
   */
  async prepare(
    files: File[],
    options: Partial<ImageCompressionOptions> = {}
  ): Promise<PreparedImages> {
    const errors: string[] = [];
    const images: PendingImage[] = [];

    for (const file of files) {
      const result = await this.compress(file, options);
      if (result.error) {
        errors.push(`${file.name}: ${result.error}`);
      }
      images.push({
        file: result.file,
        previewUrl: await this.toDataUrl(result.file),
        name: result.originalName,
        originalSize: result.originalSize,
        compressedSize: result.compressedSize,
        compressed: result.compressed,
        compressionError: result.error,
      });
    }

    return { images, errors };
  }

  /** Upload one already-compressed file and resolve with its secure URL. */
  async upload(file: File): Promise<string> {
    const data = new FormData();
    data.append('file', file);
    data.append('upload_preset', this.uploadPreset);

    const response = await firstValueFrom(
      this.http.post<{ secure_url?: string }>(this.uploadUrl, data)
    );

    if (!response?.secure_url) {
      throw new Error('Upload failed');
    }
    return response.secure_url;
  }

  /** Upload a batch in order. Rejects as soon as one upload fails. */
  async uploadAll(files: File[]): Promise<string[]> {
    const urls: string[] = [];
    for (const file of files) {
      urls.push(await this.upload(file));
    }
    return urls;
  }

  private toDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string) ?? '');
      reader.onerror = () =>
        reject(reader.error ?? new Error('Could not read the image'));
      reader.readAsDataURL(file);
    });
  }
}
