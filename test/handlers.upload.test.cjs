const test = require('node:test');
const assert = require('node:assert/strict');
const { mock } = require('node:test');

const { handleUpload } = require('../.test-dist/src/handlers/upload.js');
const { TRANSPARENT_PIXEL } = require('../.test-dist/src/config.js');
const { createEnv } = require('../test-support/helpers.cjs');

function createBaseEnv(bucketOverrides = {}, extraEnv = {}) {
  return createEnv({
    BASE_URL: 'https://img.test',
    IMAGE_BUCKET: {
      head: async () => null,
      put: async () => ({}),
      ...bucketOverrides,
    },
    ...extraEnv,
  });
}

test('handleUpload rejects empty file body', async () => {
  const request = new Request('https://api.test/images', {
    method: 'POST',
    body: new Uint8Array([]),
  });
  const response = await handleUpload(request, createBaseEnv());

  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'Empty file');
});

test('handleUpload rejects oversized body', async () => {
  const request = new Request('https://api.test/images', {
    method: 'POST',
    body: TRANSPARENT_PIXEL,
  });
  const response = await handleUpload(request, createBaseEnv({}, { MAX_FILE_SIZE: '10' }));

  assert.equal(response.status, 413);
  assert.match((await response.json()).error, /File too large/);
});

test('handleUpload rejects unsupported format', async () => {
  const request = new Request('https://api.test/images', {
    method: 'POST',
    body: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]),
  });
  const response = await handleUpload(request, createBaseEnv());

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Unsupported image format/);
});

test('handleUpload returns existing object metadata for duplicate content', async () => {
  const head = mock.fn(async () => ({
    size: 999,
    customMetadata: { deleteToken: 'existing-delete-token' },
  }));
  const put = mock.fn(async () => ({}));
  const env = createBaseEnv({ head, put });

  const request = new Request('https://api.test/images', {
    method: 'POST',
    body: TRANSPARENT_PIXEL,
  });
  const response = await handleUpload(request, env);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.deleteToken, 'existing-delete-token');
  assert.equal(put.mock.callCount(), 0);
});

test('handleUpload stores raw upload and returns 201', async () => {
  let captured = null;
  const env = createBaseEnv({
    head: async () => null,
    put: async (key, data, options) => {
      captured = { key, size: data.byteLength, options };
      return {};
    },
  });

  const request = new Request('https://api.test/images', {
    method: 'POST',
    body: TRANSPARENT_PIXEL,
    headers: {
      'Content-Disposition': 'attachment; filename="demo.png"',
      'CF-Connecting-IP': '1.2.3.4',
    },
  });
  const response = await handleUpload(request, env);
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.success, true);
  assert.match(body.data.id, /^[0-9a-f]{24}\.png$/);
  assert.equal(body.data.url, `https://img.test/images/${body.data.id}`);
  assert.ok(captured);
  assert.equal(captured.size, TRANSPARENT_PIXEL.byteLength);
  assert.equal(captured.options.customMetadata.originalName, 'demo.png');
});

test('handleUpload handles multipart request and sanitizes file name', async () => {
  let storedOriginalName = '';
  const env = createBaseEnv({
    head: async () => null,
    put: async (_key, _data, options) => {
      storedOriginalName = options.customMetadata.originalName;
      return {};
    },
  });

  const form = new FormData();
  form.set('file', new File([TRANSPARENT_PIXEL], 'bad<>name.png', { type: 'image/png' }));
  const request = new Request('https://api.test/images', {
    method: 'POST',
    body: form,
  });

  const response = await handleUpload(request, env);
  assert.equal(response.status, 201);
  assert.equal(storedOriginalName, 'bad__name.png');
});

test('handleUpload validates multipart field name file', async () => {
  const env = createBaseEnv();
  const form = new FormData();
  form.set('not-file', new File([TRANSPARENT_PIXEL], 'demo.png', { type: 'image/png' }));
  const request = new Request('https://api.test/images', {
    method: 'POST',
    body: form,
  });

  const response = await handleUpload(request, env);
  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /Use field name "file"/);
});
