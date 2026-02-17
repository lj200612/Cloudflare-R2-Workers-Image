interface RateLimitRequestPayload {
  limit: number;
  now: number;
  windowSeconds: number;
}

interface RateLimitDecision {
  allowed: boolean;
  retryAfter: number;
}

interface BucketState {
  windowKey: number;
  count: number;
}

const BUCKET_KEY = 'bucket';

export class RateLimitDurableObject {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    let payload: Partial<RateLimitRequestPayload>;
    try {
      payload = (await request.json()) as Partial<RateLimitRequestPayload>;
    } catch {
      return this.json({ error: 'Invalid JSON payload' }, 400);
    }

    if (!isValidPayload(payload)) {
      return this.json({ error: 'Invalid rate limit payload' }, 400);
    }

    const validPayload: RateLimitRequestPayload = payload;

    const decision = await this.state.storage.transaction(async (txn) => {
      const windowKey = Math.floor(validPayload.now / validPayload.windowSeconds);
      const retryAfter = validPayload.windowSeconds - (validPayload.now % validPayload.windowSeconds);

      const current = await txn.get<BucketState>(BUCKET_KEY);
      const count = !current || current.windowKey !== windowKey ? 0 : current.count;

      if (count >= validPayload.limit) {
        return {
          allowed: false,
          retryAfter,
        } satisfies RateLimitDecision;
      }

      await txn.put(BUCKET_KEY, {
        windowKey,
        count: count + 1,
      } satisfies BucketState);

      return {
        allowed: true,
        retryAfter: 0,
      } satisfies RateLimitDecision;
    });

    return this.json(decision, 200);
  }

  private json(data: unknown, status = 200): Response {
    return new Response(JSON.stringify(data), {
      status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

function isValidPayload(payload: Partial<RateLimitRequestPayload>): payload is RateLimitRequestPayload {
  const limit = payload.limit;
  const now = payload.now;
  const windowSeconds = payload.windowSeconds;

  return (
    typeof limit === 'number' &&
    Number.isInteger(limit) &&
    limit > 0 &&
    typeof now === 'number' &&
    Number.isInteger(now) &&
    now >= 0 &&
    typeof windowSeconds === 'number' &&
    Number.isInteger(windowSeconds) &&
    windowSeconds > 0
  );
}
