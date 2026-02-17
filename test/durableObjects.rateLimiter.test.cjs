const test = require('node:test');
const assert = require('node:assert/strict');

const { RateLimitDurableObject } = require('../.test-dist/src/durableObjects/rateLimiter.js');

class FakeStorage {
  constructor() {
    this.map = new Map();
  }

  async transaction(fn) {
    const txn = {
      get: async (key) => this.map.get(key),
      put: async (key, value) => {
        this.map.set(key, value);
      },
    };
    return fn(txn);
  }
}

function createObject() {
  const state = { storage: new FakeStorage() };
  return new RateLimitDurableObject(state);
}

test('DO rejects non-POST methods', async () => {
  const obj = createObject();
  const response = await obj.fetch(new Request('https://do/check', { method: 'GET' }));
  assert.equal(response.status, 405);
});

test('DO validates JSON payload shape', async () => {
  const obj = createObject();

  const invalidJson = await obj.fetch(
    new Request('https://do/check', {
      method: 'POST',
      body: '{',
      headers: { 'Content-Type': 'application/json' },
    })
  );
  assert.equal(invalidJson.status, 400);

  const invalidPayload = await obj.fetch(
    new Request('https://do/check', {
      method: 'POST',
      body: JSON.stringify({ limit: 0, now: 10, windowSeconds: 60 }),
      headers: { 'Content-Type': 'application/json' },
    })
  );
  assert.equal(invalidPayload.status, 400);
});

test('DO enforces fixed-window limit and resets next window', async () => {
  const obj = createObject();
  const payload = {
    limit: 2,
    now: 100,
    windowSeconds: 60,
  };

  const r1 = await obj.fetch(
    new Request('https://do/check', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    })
  );
  const r2 = await obj.fetch(
    new Request('https://do/check', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    })
  );
  const r3 = await obj.fetch(
    new Request('https://do/check', {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    })
  );

  assert.deepEqual(await r1.json(), { allowed: true, retryAfter: 0 });
  assert.deepEqual(await r2.json(), { allowed: true, retryAfter: 0 });
  assert.deepEqual(await r3.json(), { allowed: false, retryAfter: 20 });

  const nextWindow = await obj.fetch(
    new Request('https://do/check', {
      method: 'POST',
      body: JSON.stringify({ ...payload, now: 120 }),
      headers: { 'Content-Type': 'application/json' },
    })
  );
  assert.deepEqual(await nextWindow.json(), { allowed: true, retryAfter: 0 });
});
