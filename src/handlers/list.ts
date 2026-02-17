import type { Env, ListResult, ImageInfo } from '../types';
import { listImages, parseKey, mimeFromExt } from '../services/storage';
import { successResponse, errorResponse } from '../utils/response';

export async function handleList(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const cursor = url.searchParams.get('cursor') || undefined;
  const limitStr = url.searchParams.get('limit');
  const limit = Math.min(Math.max(parseInt(limitStr || '50', 10) || 50, 1), 100);

  const result = await listImages(env.IMAGE_BUCKET, cursor, limit);
  const baseUrl = env.BASE_URL || `https://${request.headers.get('Host') || 'localhost'}`;

  const images: ImageInfo[] = result.objects.map((obj) => {
    const parsed = parseKey(obj.key);
    const id = parsed ? `${parsed.hash}.${parsed.ext}` : obj.key;
    return {
      id,
      url: `${baseUrl}/images/${id}`,
      originalName: obj.customMetadata?.originalName || '',
      size: obj.size,
      type: parsed ? mimeFromExt(parsed.ext) : 'application/octet-stream',
      uploadedAt: obj.customMetadata?.uploadedAt || obj.uploaded.toISOString(),
    };
  });

  return successResponse<ListResult>({
    images,
    cursor: result.truncated ? result.cursor : undefined,
    hasMore: result.truncated,
  });
}
