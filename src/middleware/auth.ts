import type { Env } from '../types';
import { errorResponse } from '../utils/response';

export function verifyAuth(request: Request, env: Env): Response | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse('Missing or invalid Authorization header', 401);
  }

  const token = authHeader.slice(7);
  if (!timingSafeEqual(token, env.API_TOKEN)) {
    return errorResponse('Invalid API token', 401);
  }

  return null; // auth passed
}

function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBuf = encoder.encode(a);
  const bBuf = encoder.encode(b);

  if (aBuf.byteLength !== bBuf.byteLength) {
    // Compare a with itself to burn the same amount of time, then return false
    let x = 0;
    for (let i = 0; i < aBuf.byteLength; i++) {
      x |= aBuf[i] ^ aBuf[i];
    }
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < aBuf.byteLength; i++) {
    mismatch |= aBuf[i] ^ bBuf[i];
  }
  return mismatch === 0;
}
