const test = require('node:test');
const assert = require('node:assert/strict');
const { mock } = require('node:test');

const { checkRateLimit } = require('../.test-dist/src/middleware/rateLimit.js');
const { createEnv, createRateLimiterNamespace } = require('../test-support/helpers.cjs');

test('checkRateLimit allows request when DO allows', async () => {
  const fetchStub = mock.fn(async () =>
    new Response(JSON.stringify({ allowed: true, retryAfter: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  );
  const { namespace, calls } = createRateLimiterNamespace(fetchStub);
  const env = createEnv({
    RATE_LIMITER: namespace,
    RATE_LIMIT_UPLOADS_PER_MINUTE: '7',
  });
  const request = new Request('https://example.com/images', {
    headers: { 'CF-Connecting-IP': '1.2.3.4' },
  });

  const result = await checkRateLimit(request, env, 'upload');

  assert.equal(result, null);
  assert.equal(calls.names.length, 1);
  assert.ok(calls.names[0].startsWith('upload:'));
  assert.equal(fetchStub.mock.callCount(), 1);

  const body = JSON.parse(fetchStub.mock.calls[0].arguments[1].body);
  assert.equal(body.limit, 7);
  assert.equal(body.windowSeconds, 60);
});

test('checkRateLimit returns 429 with retry header when denied', async () => {
  const { namespace } = createRateLimiterNamespace(async () =>
    new Response(JSON.stringify({ allowed: false, retryAfter: 18 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  );
  const env = createEnv({ RATE_LIMITER: namespace });
  const request = new Request('https://example.com/images');

  const result = await checkRateLimit(request, env, 'request');

  assert.equal(result.status, 429);
  assert.equal(result.headers.get('Retry-After'), '18');
  assert.equal((await result.json()).error, 'Rate limit exceeded');
});

test('checkRateLimit returns 503 when DO responds non-200', async () => {
  const { namespace } = createRateLimiterNamespace(async () => new Response('x', { status: 500 }));
  const env = createEnv({ RATE_LIMITER: namespace });
  const request = new Request('https://example.com/images');

  const result = await checkRateLimit(request, env, 'request');
  assert.equal(result.status, 503);
  assert.equal((await result.json()).error, 'Rate limiter unavailable');
});

test('checkRateLimit returns 503 when DO payload is invalid', async () => {
  const { namespace } = createRateLimiterNamespace(async () =>
    new Response(JSON.stringify({ foo: 1 }), {
      headers: { 'Content-Type': 'application/json' },
    })
  );
  const env = createEnv({ RATE_LIMITER: namespace });
  const request = new Request('https://example.com/images');

  const result = await checkRateLimit(request, env, 'request');
  assert.equal(result.status, 503);
});
