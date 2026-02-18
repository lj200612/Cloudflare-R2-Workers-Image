import type { Env, ImageMetadata, UploadResult } from '../types';
import { detectImageType } from '../services/image';
import { buildKey, putImage, findKeyById, parseKey, mimeFromExt } from '../services/storage';
import { contentHash, generateDeleteToken, hashIp, hashToken } from '../utils/hash';
import { parseMaxFileSize, sanitizeFilename } from '../utils/validation';
import { successResponse, errorResponse } from '../utils/response';

export async function handleUpload(request: Request, env: Env): Promise<Response> {
  const maxSize = parseMaxFileSize(env.MAX_FILE_SIZE);

  let fileData: ArrayBuffer;
  let originalName = 'unknown';

  const contentType = request.headers.get('Content-Type') || '';

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file') as unknown as { name: string; arrayBuffer(): Promise<ArrayBuffer> } | string | null;
    if (!file || typeof file === 'string') {
      return errorResponse('No file found in form data. Use field name "file".');
    }
    originalName = sanitizeFilename(file.name);
    fileData = await file.arrayBuffer();
  } else {
    // Raw body upload
    fileData = await request.arrayBuffer();
    const disposition = request.headers.get('Content-Disposition');
    if (disposition) {
      const match = disposition.match(/filename="?([^";\n]+)"?/);
      if (match) originalName = sanitizeFilename(match[1]);
    }
  }

  if (fileData.byteLength === 0) {
    return errorResponse('Empty file');
  }

  if (fileData.byteLength > maxSize) {
    return errorResponse(`File too large. Maximum size is ${maxSize} bytes.`, 413);
  }

  const detected = detectImageType(fileData);
  if (!detected) {
    return errorResponse('Unsupported image format. Allowed: JPEG, PNG, GIF, WebP.');
  }

  const hash = await contentHash(fileData);
  const key = buildKey(hash, detected.ext);

  // Check for duplicate
  const existing = await env.IMAGE_BUCKET.head(key);
  if (existing) {
    const baseUrl = env.BASE_URL || `https://${request.headers.get('Host') || 'localhost'}`;
    const id = `${hash}.${detected.ext}`;
    return successResponse<UploadResult>({
      id,
      url: `${baseUrl}/images/${id}`,
      // Cannot recover the original delete token from the stored hash.
      // Use the admin API_TOKEN to delete this image if needed.
      deleteToken: '',
      size: existing.size,
      type: detected.mime,
    });
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const now = new Date().toISOString();
  const deleteToken = await generateDeleteToken(hash, now);
  const deleteTokenHash = await hashToken(deleteToken);
  const ipHash = await hashIp(ip);

  const metadata: ImageMetadata = {
    originalName,
    uploadedAt: now,
    uploaderIpHash: ipHash,
    deleteTokenHash,
    sizeBytes: fileData.byteLength,
  };

  await putImage(env.IMAGE_BUCKET, key, fileData, metadata, detected.mime);

  const baseUrl = env.BASE_URL || `https://${request.headers.get('Host') || 'localhost'}`;
  const id = `${hash}.${detected.ext}`;

  return successResponse<UploadResult>(
    {
      id,
      url: `${baseUrl}/images/${id}`,
      deleteToken,
      size: fileData.byteLength,
      type: detected.mime,
    },
    201
  );
}
