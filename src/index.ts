import type { Env } from './types';
import { verifyAuth } from './middleware/auth';
import { corsHeaders, handleOptions } from './middleware/cors';
import { checkReferer } from './middleware/referer';
import { checkRateLimit } from './middleware/rateLimit';
import { handleUpload } from './handlers/upload';
import { handleServe } from './handlers/serve';
import { handleDelete, handleBulkDelete } from './handlers/delete';
import { handleList } from './handlers/list';
import { handleInfo } from './handlers/info';
import { errorResponse, successResponse } from './utils/response';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return handleOptions(request, env);
    }

    let response: Response;

    try {
      response = await route(request, env, method, path);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      response = errorResponse(message, 500);
    }

    // Attach CORS headers to all responses
    const cors = corsHeaders(request, env);
    for (const [key, value] of Object.entries(cors)) {
      response.headers.set(key, value);
    }

    return response;
  },
} satisfies ExportedHandler<Env>;

async function route(
  request: Request,
  env: Env,
  method: string,
  path: string
): Promise<Response> {
  // Health check
  if (path === '/health' && method === 'GET') {
    return successResponse({ status: 'ok' });
  }

  // POST /images - Upload
  if (path === '/images' && method === 'POST') {
    const authErr = verifyAuth(request, env);
    if (authErr) return authErr;

    const rateLimitErr = await checkRateLimit(request, env, 'upload');
    if (rateLimitErr) return rateLimitErr;

    return handleUpload(request, env);
  }

  // POST /images/bulk-delete - Bulk delete
  if (path === '/images/bulk-delete' && method === 'POST') {
    const authErr = verifyAuth(request, env);
    if (authErr) return authErr;

    return handleBulkDelete(request, env);
  }

  // GET /images - List
  if (path === '/images' && method === 'GET') {
    const authErr = verifyAuth(request, env);
    if (authErr) return authErr;

    return handleList(request, env);
  }

  // Routes with :id parameter
  const imageMatch = path.match(/^\/images\/([^/]+)$/);
  const infoMatch = path.match(/^\/images\/([^/]+)\/info$/);

  // GET /images/:id/info - Image metadata
  if (infoMatch && method === 'GET') {
    const authErr = verifyAuth(request, env);
    if (authErr) return authErr;

    return handleInfo(request, env, decodeURIComponent(infoMatch[1]));
  }

  // GET /images/:id - Serve image
  if (imageMatch && method === 'GET') {
    const refererErr = checkReferer(request, env);
    if (refererErr) return refererErr;

    const rateLimitErr = await checkRateLimit(request, env, 'request');
    if (rateLimitErr) return rateLimitErr;

    return handleServe(request, env, decodeURIComponent(imageMatch[1]));
  }

  // DELETE /images/:id - Delete image
  if (imageMatch && method === 'DELETE') {
    return handleDelete(request, env, decodeURIComponent(imageMatch[1]));
  }

  return errorResponse('Not found', 404);
}
