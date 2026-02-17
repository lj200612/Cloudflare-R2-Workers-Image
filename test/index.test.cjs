const test = require('node:test');
const assert = require('node:assert/strict');

const workerModule = require('../.test-dist/src/index.js');
const worker = workerModule.default;
const { TRANSPARENT_PIXEL } = require('../.test-dist/src/config.js');
const { createEnv } = require('../test-support/helpers.cjs');

test('worker handles OPTIONS preflight', async () => {
  const env = createEnv();
  const response = await worker.fetch(
    new Request('https://api.test/images', { method: 'OPTIONS' }),
    env
  );

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
});

test('worker returns health response', async () => {
  const env = createEnv();
  const response = await worker.fetch(new Request('https://api.test/health'), env);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.status, 'ok');
});

test('worker returns 404 for unknown routes', async () => {
  const env = createEnv();
  const response = await worker.fetch(new Request('https://api.test/unknown'), env);
  assert.equal(response.status, 404);
});

test('worker enforces auth on protected routes', async () => {
  const env = createEnv();
  const response = await worker.fetch(new Request('https://api.test/images', { method: 'POST' }), env);

  assert.equal(response.status, 401);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
});

test('worker blocks disallowed referer on public image route', async () => {
  const env = createEnv({
    ALLOWED_REFERERS: 'example.com',
    ALLOW_EMPTY_REFERER: 'false',
  });
  const response = await worker.fetch(new Request('https://api.test/images/x.png'), env);

  assert.equal(response.status, 403);
  assert.equal(response.headers.get('Content-Type'), 'image/png');
});

test('worker runs image GET path and reaches handler', async () => {
  const env = createEnv({
    IMAGE_BUCKET: {
      head: async () => null,
      get: async () => null,
    },
  });
  const response = await worker.fetch(new Request('https://api.test/images/x.png'), env);
  assert.equal(response.status, 404);
});

test('worker catches unhandled errors and returns 500', async () => {
  const env = createEnv({
    IMAGE_BUCKET: {
      head: async () => {
        throw new Error('boom');
      },
      put: async () => ({}),
    },
  });
  const request = new Request('https://api.test/images', {
    method: 'POST',
    headers: { Authorization: 'Bearer secret-token' },
    body: TRANSPARENT_PIXEL,
  });

  const response = await worker.fetch(request, env);
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.equal(body.success, false);
  assert.equal(body.error, 'boom');
});
