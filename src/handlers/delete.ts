import type { Env } from '../types';
import { findKeyById, deleteImage } from '../services/storage';
import { verifyAuth } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';

export async function handleDelete(
  request: Request,
  env: Env,
  id: string
): Promise<Response> {
  // Check for admin token or delete token
  const authResult = verifyAuth(request, env);
  const deleteToken = request.headers.get('X-Delete-Token');

  if (authResult && !deleteToken) {
    return authResult; // neither auth method provided
  }

  const key = await findKeyById(env.IMAGE_BUCKET, id);
  if (!key) {
    return errorResponse('Image not found', 404);
  }

  // If using delete token, verify it matches
  if (authResult && deleteToken) {
    const obj = await env.IMAGE_BUCKET.head(key);
    if (!obj) {
      return errorResponse('Image not found', 404);
    }
    const storedToken = obj.customMetadata?.deleteToken;
    if (!storedToken || storedToken !== deleteToken) {
      return errorResponse('Invalid delete token', 403);
    }
  }

  await deleteImage(env.IMAGE_BUCKET, key);
  return successResponse({ deleted: id });
}

export async function handleBulkDelete(
  request: Request,
  env: Env
): Promise<Response> {
  let body: { ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body');
  }

  if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
    return errorResponse('Provide an array of image ids in "ids" field');
  }

  if (body.ids.length > 100) {
    return errorResponse('Maximum 100 images per bulk delete request');
  }

  const results: { id: string; deleted: boolean; error?: string }[] = [];

  for (const id of body.ids) {
    const key = await findKeyById(env.IMAGE_BUCKET, id);
    if (!key) {
      results.push({ id, deleted: false, error: 'not found' });
      continue;
    }
    await deleteImage(env.IMAGE_BUCKET, key);
    results.push({ id, deleted: true });
  }

  return successResponse({ results });
}
