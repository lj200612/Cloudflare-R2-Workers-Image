import type { Env } from '../types';

export function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') || '';
  const allowedOrigins = env.ALLOWED_ORIGINS || '*';

  let allowOrigin = '';
  if (allowedOrigins === '*') {
    allowOrigin = '*';
  } else {
    const origins = allowedOrigins.split(',').map((o) => o.trim());
    if (origins.includes(origin)) {
      allowOrigin = origin;
    }
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Delete-Token',
    'Access-Control-Max-Age': '86400',
  };
}

export function handleOptions(request: Request, env: Env): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, env),
  });
}
