const test = require('node:test');
const assert = require('node:assert/strict');
const { mock } = require('node:test');

const { handleServe } = require('../.test-dist/src/handlers/serve.js');
const { createEnv } = require('../test-support/helpers.cjs');

function createBucket(overrides = {}) {
  return {
    head: async () => ({ key: 'images/abc.png' }),
    get: async () => ({
      body: new Uint8Array([1, 2, 3]),
      etag: 'etag-1',
    }),
    ...overrides,
  };
}

test('handleServe returns 404 when image key is not found', async () => {
  const env = createEnv({
    IMAGE_BUCKET: createBucket({
      head: async () => null,
    }),
  });

  const response = await handleServe(new Request('https://api.test/images/abc.png'), env, 'abc.png');
  assert.equal(response.status, 404);
});

test('handleServe returns 404 when object body is missing', async () => {
  const env = createEnv({
    IMAGE_BUCKET: createBucket({
      get: async () => null,
    }),
  });

  const response = await handleServe(new Request('https://api.test/images/abc.png'), env, 'abc.png');
  assert.equal(response.status, 404);
});

test('handleServe returns 304 on matching If-None-Match', async () => {
  const env = createEnv({
    IMAGE_BUCKET: createBucket(),
  });
  const request = new Request('https://api.test/images/abc.png', {
    headers: { 'If-None-Match': 'etag-1' },
  });

  const response = await handleServe(request, env, 'abc.png');
  assert.equal(response.status, 304);
  assert.equal(response.headers.get('ETag'), 'etag-1');
});

test('handleServe returns image body with cache headers', async () => {
  const env = createEnv({
    IMAGE_BUCKET: createBucket(),
  });
  const response = await handleServe(new Request('https://api.test/images/abc.png'), env, 'abc.png');
  const bytes = new Uint8Array(await response.arrayBuffer());

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'image/png');
  assert.equal(response.headers.get('Cache-Control'), 'public, max-age=31536000, immutable');
  assert.deepEqual(Array.from(bytes), [1, 2, 3]);
});

test('handleServe transformed path bypasses recursion when Via has image-resizing', async () => {
  const env = createEnv({
    ENABLE_IMAGE_RESIZING: 'true',
    IMAGE_BUCKET: createBucket(),
  });
  const request = new Request('https://api.test/images/abc.png?w=100', {
    headers: { Via: 'cloudflare image-resizing' },
  });

  const response = await handleServe(request, env, 'abc.png');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Content-Type'), 'image/png');
});

test('handleServe transformed path proxies through fetch with cf.image options', async () => {
  const fetchMock = mock.fn(async () => new Response('ok', { status: 200 }));
  const originalFetch = global.fetch;
  global.fetch = fetchMock;

  try {
    const env = createEnv({
      ENABLE_IMAGE_RESIZING: 'true',
      BASE_URL: 'https://cdn.test',
      IMAGE_BUCKET: createBucket(),
    });
    const request = new Request(
      'https://api.test/images/abc.png?preset=thumb&f=webp&w=120&fit=cover'
    );

    const response = await handleServe(request, env, 'abc.png');
    assert.equal(response.status, 200);
    assert.equal(fetchMock.mock.callCount(), 1);

    const [proxyRequest, proxyInit] = fetchMock.mock.calls[0].arguments;
    assert.equal(proxyRequest.url, 'https://cdn.test/images/abc.png');
    assert.equal(proxyInit.cf.image.width, 150);
    assert.equal(proxyInit.cf.image.height, 150);
    assert.equal(proxyInit.cf.image.fit, 'cover');
  } finally {
    global.fetch = originalFetch;
  }
});
