import type { Env } from '../types';
import { hashIp } from '../utils/hash';
import { parsePositiveInt } from '../utils/validation';
import { errorResponse } from '../utils/response';

export async function checkRateLimit(
  request: Request,
  env: Env,
  action: 'upload' | 'request'
): Promise<Response | null> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipHash = await hashIp(ip);

  const windowSeconds = 60;
  const now = Math.floor(Date.now() / 1000);
  const windowKey = Math.floor(now / windowSeconds);

  const limit =
    action === 'upload'
      ? parsePositiveInt(env.RATE_LIMIT_UPLOADS_PER_MINUTE, 10)
      : parsePositiveInt(env.RATE_LIMIT_REQUESTS_PER_MINUTE, 60);

  const kvKey = `rl:${action}:${ipHash}:${windowKey}`;

  const current = parseInt((await env.RATE_LIMIT_KV.get(kvKey)) || '0', 10);

  if (current >= limit) {
    return errorResponse('Rate limit exceeded', 429, {
      'Retry-After': String(windowSeconds - (now % windowSeconds)),
    });
  }

  await env.RATE_LIMIT_KV.put(kvKey, String(current + 1), {
    expirationTtl: windowSeconds * 2,
  });

  return null; // within limit
}
