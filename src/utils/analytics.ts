import type { Env } from '../types';

export interface RequestLog {
  method: string;
  path: string;
  status: number;
  durationMs: number;
  error?: string;
}

export function logRequest(env: Env, data: RequestLog): void {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      method: data.method,
      path: data.path,
      status: data.status,
      durationMs: data.durationMs,
      ...(data.error ? { error: data.error } : {}),
    })
  );

  if (env.ANALYTICS) {
    try {
      env.ANALYTICS.writeDataPoint({
        blobs: [data.method, data.path, data.error ?? ''],
        doubles: [data.status, data.durationMs],
        indexes: [String(data.status)],
      });
    } catch {
      // Analytics failure must never break the main request
    }
  }
}
