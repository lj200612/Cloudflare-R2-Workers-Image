import type { Env, ImageMetadata } from '../types';
import { IMAGE_KEY_PREFIX, EXT_TO_MIME } from '../config';

export function buildKey(hash: string, ext: string): string {
  return `${IMAGE_KEY_PREFIX}${hash}.${ext}`;
}

export function parseKey(key: string): { hash: string; ext: string } | null {
  if (!key.startsWith(IMAGE_KEY_PREFIX)) return null;
  const filename = key.slice(IMAGE_KEY_PREFIX.length);
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex === -1) return null;
  return {
    hash: filename.slice(0, dotIndex),
    ext: filename.slice(dotIndex + 1),
  };
}

export function mimeFromExt(ext: string): string {
  return EXT_TO_MIME[ext.toLowerCase()] || 'application/octet-stream';
}

export async function putImage(
  bucket: R2Bucket,
  key: string,
  data: ArrayBuffer,
  metadata: ImageMetadata,
  contentType: string
): Promise<R2Object> {
  return bucket.put(key, data, {
    httpMetadata: {
      contentType,
      cacheControl: 'public, max-age=31536000, immutable',
    },
    customMetadata: {
      originalName: metadata.originalName,
      uploadedAt: metadata.uploadedAt,
      uploaderIpHash: metadata.uploaderIpHash,
      deleteTokenHash: metadata.deleteTokenHash,
      sizeBytes: String(metadata.sizeBytes),
    },
  });
}

export async function getImage(
  bucket: R2Bucket,
  key: string
): Promise<R2ObjectBody | null> {
  return bucket.get(key);
}

export async function headImage(
  bucket: R2Bucket,
  key: string
): Promise<R2Object | null> {
  return bucket.head(key);
}

export async function deleteImage(
  bucket: R2Bucket,
  key: string
): Promise<void> {
  await bucket.delete(key);
}

export async function listImages(
  bucket: R2Bucket,
  cursor?: string,
  limit = 50
): Promise<R2Objects> {
  return bucket.list({
    prefix: IMAGE_KEY_PREFIX,
    limit,
    cursor: cursor || undefined,
  });
}

export function resolveImageId(bucket: R2Bucket, id: string): string | null {
  // id could be "abc123" or "abc123.jpg" — we need to find the key
  // If it contains an extension, use directly
  if (id.includes('.')) {
    return `${IMAGE_KEY_PREFIX}${id}`;
  }
  // Otherwise we don't know the extension. Caller should list or try known extensions.
  return null;
}

export async function findKeyById(bucket: R2Bucket, id: string): Promise<string | null> {
  // If id already has extension
  if (id.includes('.')) {
    const key = `${IMAGE_KEY_PREFIX}${id}`;
    const obj = await bucket.head(key);
    return obj ? key : null;
  }

  // Try all known extensions
  const exts = ['jpg', 'png', 'gif', 'webp'];
  for (const ext of exts) {
    const key = buildKey(id, ext);
    const obj = await bucket.head(key);
    if (obj) return key;
  }
  return null;
}
