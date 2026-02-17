import type { ApiResponse } from '../types';
import { TRANSPARENT_PIXEL } from '../config';

export function jsonResponse<T>(data: ApiResponse<T>, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

export function successResponse<T>(data: T, status = 200, headers?: Record<string, string>): Response {
  return jsonResponse({ success: true, data }, status, headers);
}

export function errorResponse(error: string, status = 400, headers?: Record<string, string>): Response {
  return jsonResponse({ success: false, error }, status, headers);
}

export function transparentPixelResponse(): Response {
  return new Response(TRANSPARENT_PIXEL, {
    status: 403,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store',
    },
  });
}
