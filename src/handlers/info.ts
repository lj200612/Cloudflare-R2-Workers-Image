import type { Env, ImageInfo } from '../types';
import { findKeyById, parseKey, mimeFromExt } from '../services/storage';
import { successResponse, errorResponse } from '../utils/response';

export async function handleInfo(
  request: Request,
  env: Env,
  id: string
): Promise<Response> {
  const key = await findKeyById(env.IMAGE_BUCKET, id);
  if (!key) {
    return errorResponse('Image not found', 404);
  }

  const obj = await env.IMAGE_BUCKET.head(key);
  if (!obj) {
    return errorResponse('Image not found', 404);
  }

  const parsed = parseKey(key);
  const imageId = parsed ? `${parsed.hash}.${parsed.ext}` : key;
  const baseUrl = env.BASE_URL || `https://${request.headers.get('Host') || 'localhost'}`;

  return successResponse<ImageInfo>({
    id: imageId,
    url: `${baseUrl}/images/${imageId}`,
    originalName: obj.customMetadata?.originalName || '',
    size: obj.size,
    type: parsed ? mimeFromExt(parsed.ext) : 'application/octet-stream',
    uploadedAt: obj.customMetadata?.uploadedAt || obj.uploaded.toISOString(),
  });
}
