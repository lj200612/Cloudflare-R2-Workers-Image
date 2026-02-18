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
import { logRequest } from './utils/analytics';

type RouteParams = Record<string, string>;
type RouteMatch = (path: string) => RouteParams | null;
type RouteGuard = (
  request: Request,
  env: Env,
  params: RouteParams
) => Promise<Response | null> | Response | null;
type RouteHandler = (
  request: Request,
  env: Env,
  params: RouteParams
) => Promise<Response>;

interface RouteDefinition {
  method: 'GET' | 'POST' | 'DELETE';
  match: RouteMatch;
  guards: RouteGuard[];
  handler: RouteHandler;
}

const requireAuth: RouteGuard = (request, env) => verifyAuth(request, env);
const requireReferer: RouteGuard = (request, env) => checkReferer(request, env);
const limitUpload: RouteGuard = (request, env) => checkRateLimit(request, env, 'upload');
const limitRequest: RouteGuard = (request, env) => checkRateLimit(request, env, 'request');

const routes: RouteDefinition[] = [
  {
    method: 'GET',
    match: exactPath('/health'),
    guards: [],
    handler: async () => successResponse({ status: 'ok' }),
  },
  {
    method: 'POST',
    match: exactPath('/images'),
    guards: [requireAuth, limitUpload],
    handler: (request, env) => handleUpload(request, env),
  },
  {
    method: 'POST',
    match: exactPath('/images/bulk-delete'),
    guards: [requireAuth],
    handler: (request, env) => handleBulkDelete(request, env),
  },
  {
    method: 'GET',
    match: exactPath('/images'),
    guards: [requireAuth],
    handler: (request, env) => handleList(request, env),
  },
  {
    method: 'GET',
    match: regexPath(/^\/images\/([^/]+)\/info$/, 'id'),
    guards: [requireAuth],
    handler: (request, env, params) => handleInfo(request, env, params.id),
  },
  {
    method: 'GET',
    match: regexPath(/^\/images\/([^/]+)$/, 'id'),
    guards: [requireReferer, limitRequest],
    handler: (request, env, params) => handleServe(request, env, params.id),
  },
  {
    method: 'DELETE',
    match: regexPath(/^\/images\/([^/]+)$/, 'id'),
    guards: [],
    handler: (request, env, params) => handleDelete(request, env, params.id),
  },
];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const start = Date.now();
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return handleOptions(request, env);
    }

    let response: Response;
    let caughtError: string | undefined;

    try {
      response = await route(request, env, method, path);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      caughtError = message;
      response = errorResponse(message, 500);
    }

    // Attach CORS headers to all responses
    const cors = corsHeaders(request, env);
    for (const [key, value] of Object.entries(cors)) {
      response.headers.set(key, value);
    }

    logRequest(env, {
      method,
      path,
      status: response.status,
      durationMs: Date.now() - start,
      ...(caughtError ? { error: caughtError } : {}),
    });

    return response;
  },
} satisfies ExportedHandler<Env>;

async function route(
  request: Request,
  env: Env,
  method: string,
  path: string
): Promise<Response> {
  for (const definition of routes) {
    if (definition.method !== method) {
      continue;
    }

    const params = definition.match(path);
    if (!params) {
      continue;
    }

    for (const guard of definition.guards) {
      const guardError = await guard(request, env, params);
      if (guardError) {
        return guardError;
      }
    }

    return definition.handler(request, env, params);
  }

  return errorResponse('Not found', 404);
}

function exactPath(expectedPath: string): RouteMatch {
  return (path) => (path === expectedPath ? {} : null);
}

function regexPath(pattern: RegExp, paramName: string): RouteMatch {
  return (path) => {
    const match = path.match(pattern);
    if (!match) {
      return null;
    }

    try {
      return { [paramName]: decodeURIComponent(match[1]) };
    } catch {
      return null;
    }
  };
}

export { RateLimitDurableObject } from './durableObjects/rateLimiter';
