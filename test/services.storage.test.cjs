const test = require('node:test');
const assert = require('node:assert/strict');
const { mock } = require('node:test');

const {
  buildKey,
  parseKey,
  mimeFromExt,
  putImage,
  getImage,
  headImage,
  deleteImage,
  listImages,
  resolveImageId,
  findKeyById,
} = require('../.test-dist/src/services/storage.js');

test('buildKey and parseKey round-trip', () => {
  const key = buildKey('abc123', 'png');
  assert.equal(key, 'images/abc123.png');
  assert.deepEqual(parseKey(key), { hash: 'abc123', ext: 'png' });
});

test('parseKey rejects invalid keys', () => {
  assert.equal(parseKey('x/abc.png'), null);
  assert.equal(parseKey('images/no-dot'), null);
});

test('mimeFromExt resolves known and fallback values', () => {
  assert.equal(mimeFromExt('jpg'), 'image/jpeg');
  assert.equal(mimeFromExt('PNG'), 'image/png');
  assert.equal(mimeFromExt('bin'), 'application/octet-stream');
});

test('putImage passes metadata and headers to bucket.put', async () => {
  const put = mock.fn(async () => ({ etag: 'e1' }));
  const bucket = { put };
  const meta = {
    originalName: 'demo.png',
    uploadedAt: '2026-01-01T00:00:00.000Z',
    uploaderIpHash: 'abc',
    deleteTokenHash: 'token-hash',
    sizeBytes: 10,
  };

  const result = await putImage(bucket, 'images/h.png', new Uint8Array([1, 2]).buffer, meta, 'image/png');
  assert.equal(result.etag, 'e1');
  assert.equal(put.mock.callCount(), 1);

  const call = put.mock.calls[0];
  assert.equal(call.arguments[0], 'images/h.png');
  assert.equal(call.arguments[2].httpMetadata.contentType, 'image/png');
  assert.equal(call.arguments[2].customMetadata.deleteTokenHash, 'token-hash');
  assert.equal(call.arguments[2].customMetadata.sizeBytes, '10');
});

test('get/head/delete/list wrappers delegate to bucket', async () => {
  const get = mock.fn(async () => ({ body: 'x' }));
  const head = mock.fn(async () => ({ key: 'k' }));
  const del = mock.fn(async () => {});
  const list = mock.fn(async () => ({ objects: [], truncated: false }));
  const bucket = { get, head, delete: del, list };

  await getImage(bucket, 'k1');
  await headImage(bucket, 'k2');
  await deleteImage(bucket, 'k3');
  await listImages(bucket, 'cursor1', 20);

  assert.equal(get.mock.calls[0].arguments[0], 'k1');
  assert.equal(head.mock.calls[0].arguments[0], 'k2');
  assert.equal(del.mock.calls[0].arguments[0], 'k3');
  assert.deepEqual(list.mock.calls[0].arguments[0], {
    prefix: 'images/',
    limit: 20,
    cursor: 'cursor1',
  });
});

test('resolveImageId handles ids with and without extension', () => {
  assert.equal(resolveImageId({}, 'abc.png'), 'images/abc.png');
  assert.equal(resolveImageId({}, 'abc123'), null);
});

test('findKeyById checks direct id with extension first', async () => {
  const head = mock.fn(async (key) => (key === 'images/abc.png' ? { key } : null));
  const bucket = { head };

  const found = await findKeyById(bucket, 'abc.png');
  assert.equal(found, 'images/abc.png');
  assert.equal(head.mock.callCount(), 1);
});

test('findKeyById checks known extensions when id has no ext', async () => {
  const head = mock.fn(async (key) => (key === 'images/hash.webp' ? { key } : null));
  const bucket = { head };

  const found = await findKeyById(bucket, 'hash');
  assert.equal(found, 'images/hash.webp');
  assert.equal(head.mock.callCount(), 4);
});
