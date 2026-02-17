import type { Env } from '../types';
import { hashIp } from '../utils/hash';
import { parsePositiveInt } from '../utils/validation';
import { errorResponse } from '../utils/response';

const WINDOW_SECONDS = 60;

interface RateLimitDecision {
  allowed: boolean;
  retryAfter: number;
}

export async function checkRateLimit(
  request: Request,
  env: Env,
  action: 'upload' | 'request'
): Promise<Response | null> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ipHash = await hashIp(ip);

  const now = Math.floor(Date.now() / 1000);

  const limit =
    action === 'upload'
      ? parsePositiveInt(env.RATE_LIMIT_UPLOADS_PER_MINUTE, 10)
      : parsePositiveInt(env.RATE_LIMIT_REQUESTS_PER_MINUTE, 60);

  let decision: RateLimitDecision;
  try {
    decision = await queryRateLimiter(env, action, ipHash, limit, now);
  } catch {
    return errorResponse('Rate limiter unavailable', 503);
  }

  if (!decision.allowed) {
    return errorResponse('Rate limit exceeded', 429, {
      'Retry-After': String(decision.retryAfter),
    });
  }

  return null; // within limit
}

async function queryRateLimiter(
  env: Env,
  action: 'upload' | 'request',
  ipHash: string,
  limit: number,
  now: number
): Promise<RateLimitDecision> {
  const id = env.RATE_LIMITER.idFromName(`${action}:${ipHash}`);
  const stub = env.RATE_LIMITER.get(id);

  const response = await stub.fetch('https://rate-limiter/check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      limit,
      now,
      windowSeconds: WINDOW_SECONDS,
    }),
  });

  if (!response.ok) {
    throw new Error(`Rate limiter returned ${response.status}`);
  }

  const payload = (await response.json()) as Partial<RateLimitDecision>;
  if (typeof payload.allowed !== 'boolean' || typeof payload.retryAfter !== 'number') {
    throw new Error('Invalid rate limiter payload');
  }

  return {
    allowed: payload.allowed,
    retryAfter: Math.max(0, Math.floor(payload.retryAfter)),
  };
}
