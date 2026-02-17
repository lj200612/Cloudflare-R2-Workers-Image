import type { Env } from '../types';
import { parseBoolean } from '../utils/validation';
import { transparentPixelResponse } from '../utils/response';

export function checkReferer(request: Request, env: Env): Response | null {
  const allowedReferers = env.ALLOWED_REFERERS?.trim();
  if (!allowedReferers) {
    return null; // no referer restriction configured
  }

  const referer = request.headers.get('Referer');
  if (!referer) {
    const allowEmpty = parseBoolean(env.ALLOW_EMPTY_REFERER, true);
    return allowEmpty ? null : transparentPixelResponse();
  }

  let refererHost: string;
  try {
    refererHost = new URL(referer).hostname;
  } catch {
    return transparentPixelResponse();
  }

  const patterns = allowedReferers.split(',').map((p) => p.trim().toLowerCase());

  for (const pattern of patterns) {
    if (matchDomain(refererHost.toLowerCase(), pattern)) {
      return null; // allowed
    }
  }

  return transparentPixelResponse();
}

function matchDomain(hostname: string, pattern: string): boolean {
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(2); // e.g. "example.com"
    return hostname === suffix || hostname.endsWith('.' + suffix);
  }
  return hostname === pattern;
}
