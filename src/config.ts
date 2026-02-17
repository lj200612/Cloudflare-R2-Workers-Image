import type { DetectedType, ImageTransformOptions } from './types';

export const MAGIC_BYTES: { bytes: number[]; offset: number; type: DetectedType }[] = [
  { bytes: [0xff, 0xd8, 0xff], offset: 0, type: { mime: 'image/jpeg', ext: 'jpg' } },
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], offset: 0, type: { mime: 'image/png', ext: 'png' } },
  { bytes: [0x47, 0x49, 0x46, 0x38], offset: 0, type: { mime: 'image/gif', ext: 'gif' } },
  { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0, type: { mime: 'image/webp', ext: 'webp' } }, // RIFF header; also check WEBP at offset 8
];

export const WEBP_MARKER = [0x57, 0x45, 0x42, 0x50]; // "WEBP" at offset 8

export const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);

export const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

export const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const IMAGE_KEY_PREFIX = 'images/';

export const TRANSFORM_PRESETS: Record<string, ImageTransformOptions> = {
  thumb: { width: 150, height: 150, fit: 'cover' },
  small: { width: 300, fit: 'scale-down' },
  medium: { width: 600, fit: 'scale-down' },
  large: { width: 1200, fit: 'scale-down' },
};

// 1x1 transparent PNG
export const TRANSPARENT_PIXEL = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
  0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x62, 0x00, 0x00, 0x00, 0x02,
  0x00, 0x01, 0xe5, 0x27, 0xde, 0xfc, 0x00, 0x00,
  0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42,
  0x60, 0x82,
]);
