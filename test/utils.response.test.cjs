const test = require('node:test');
const assert = require('node:assert/strict');

const {
  jsonResponse,
  successResponse,
  errorResponse,
  transparentPixelResponse,
} = require('../.test-dist/src/utils/response.js');

test('jsonResponse sets JSON body and headers', async () => {
  const response = jsonResponse({ success: true, data: { ok: 1 } }, 201, { 'X-Test': 'yes' });
  assert.equal(response.status, 201);
  assert.equal(response.headers.get('Content-Type'), 'application/json');
  assert.equal(response.headers.get('X-Test'), 'yes');
  assert.deepEqual(await response.json(), { success: true, data: { ok: 1 } });
});

test('successResponse wraps payload', async () => {
  const response = successResponse({ hello: 'world' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true, data: { hello: 'world' } });
});

test('errorResponse wraps error', async () => {
  const response = errorResponse('bad request', 400);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { success: false, error: 'bad request' });
});

test('transparentPixelResponse returns 403 png body', async () => {
  const response = transparentPixelResponse();
  const buffer = await response.arrayBuffer();

  assert.equal(response.status, 403);
  assert.equal(response.headers.get('Content-Type'), 'image/png');
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.ok(buffer.byteLength > 0);
});
