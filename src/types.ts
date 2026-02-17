export interface Env {
  IMAGE_BUCKET: R2Bucket;
  RATE_LIMIT_KV: KVNamespace;
  API_TOKEN: string;
  ALLOWED_REFERERS: string;
  ALLOW_EMPTY_REFERER: string;
  MAX_FILE_SIZE: string;
  ALLOWED_ORIGINS: string;
  BASE_URL: string;
  ENABLE_IMAGE_RESIZING: string;
  RATE_LIMIT_UPLOADS_PER_MINUTE: string;
  RATE_LIMIT_REQUESTS_PER_MINUTE: string;
}

export interface ImageMetadata {
  originalName: string;
  uploadedAt: string;
  uploaderIpHash: string;
  deleteToken: string;
  sizeBytes: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface UploadResult {
  id: string;
  url: string;
  deleteToken: string;
  size: number;
  type: string;
}

export interface ImageInfo {
  id: string;
  url: string;
  originalName: string;
  size: number;
  type: string;
  uploadedAt: string;
}

export interface ListResult {
  images: ImageInfo[];
  cursor?: string;
  hasMore: boolean;
}

export type ImageResizingFormat = 'jpeg' | 'png' | 'webp' | 'json' | 'avif' | 'baseline-jpeg' | 'png-force' | 'svg';

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  format?: ImageResizingFormat;
  fit?: 'contain' | 'cover' | 'crop' | 'scale-down';
}

export type ImageFormat = 'jpeg' | 'png' | 'gif' | 'webp';

export interface DetectedType {
  mime: string;
  ext: string;
}
