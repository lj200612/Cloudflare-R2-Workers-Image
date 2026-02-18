const test = require('node:test');
const assert = require('node:assert/strict');
const { mock } = require('node:test');

const { handleDelete, handleBulkDelete } = require('../.test-dist/src/handlers/delete.js');
const { createEnv } = require('../test-support/helpers.cjs');

function request(method, headers = {}, body) {
  return new Request('https://api.test/images/x', { method, headers, body });
}

test('handleDelete requires auth or delete token', async () => {
  const env = createEnv();
  const response = await handleDelete(request('DELETE'), env, 'abc.png');
  assert.equal(response.status, 401);
});

test('handleDelete returns 404 when image not found', async () => {
  const env = createEnv({
    IMAGE_BUCKET: {
      head: async () => null,
      delete: async () => {},
    },
  });
  const response = await handleDelete(
    request('DELETE', { Authorization: 'Bearer secret-token' }),
    env,
    'abc.png'
  );
  assert.equal(response.status, 404);
});

test('handleDelete validates delete token when auth is missing (legacy plain-text format)', async () => {
  const deleteFn = mock.fn(async () => {});
  const env = createEnv({
    IMAGE_BUCKET: {
      head: async () => ({ customMetadata: { deleteToken: 'valid-token' } }),
      delete: deleteFn,
    },
  });

  const bad = await handleDelete(
    request('DELETE', { 'X-Delete-Token': 'bad-token' }),
    env,
    'abc.png'
  );
  assert.equal(bad.status, 403);

  const ok = await handleDelete(
    request('DELETE', { 'X-Delete-Token': 'valid-token' }),
    env,
    'abc.png'
  );
  assert.equal(ok.status, 200);
  assert.equal(deleteFn.mock.callCount(), 1);
});

test('handleDelete validates delete token using hashed format', async () => {
  // SHA-256('valid-token') as hex
  const { createHash } = require('node:crypto');
  const storedHash = createHash('sha256').update('valid-token').digest('hex');

  const deleteFn = mock.fn(async () => {});
  const env = createEnv({
    IMAGE_BUCKET: {
      head: async () => ({ customMetadata: { deleteTokenHash: storedHash } }),
      delete: deleteFn,
    },
  });

  const bad = await handleDelete(
    request('DELETE', { 'X-Delete-Token': 'bad-token' }),
    env,
    'abc.png'
  );
  assert.equal(bad.status, 403);

  const ok = await handleDelete(
    request('DELETE', { 'X-Delete-Token': 'valid-token' }),
    env,
    'abc.png'
  );
  assert.equal(ok.status, 200);
  assert.equal(deleteFn.mock.callCount(), 1);
});

test('handleDelete prefers hashed token when both hash and legacy fields exist', async () => {
  const { createHash } = require('node:crypto');
  const storedHash = createHash('sha256').update('hashed-token').digest('hex');

  const deleteFn = mock.fn(async () => {});
  const env = createEnv({
    IMAGE_BUCKET: {
      head: async () => ({
        customMetadata: {
          deleteTokenHash: storedHash,
          deleteToken: 'legacy-plain-token', // should be ignored
        },
      }),
      delete: deleteFn,
    },
  });

  // Legacy plain-text token should NOT work when hash field is present
  const legacyAttempt = await handleDelete(
    request('DELETE', { 'X-Delete-Token': 'legacy-plain-token' }),
    env,
    'abc.png'
  );
  assert.equal(legacyAttempt.status, 403);

  // The hash-matched token should work
  const hashAttempt = await handleDelete(
    request('DELETE', { 'X-Delete-Token': 'hashed-token' }),
    env,
    'abc.png'
  );
  assert.equal(hashAttempt.status, 200);
  assert.equal(deleteFn.mock.callCount(), 1);
});

test('handleDelete returns 403 when metadata has neither hash nor legacy token', async () => {
  const deleteFn = mock.fn(async () => {});
  const env = createEnv({
    IMAGE_BUCKET: {
      head: async () => ({ customMetadata: {} }),
      delete: deleteFn,
    },
  });

  const response = await handleDelete(
    request('DELETE', { 'X-Delete-Token': 'any-token' }),
    env,
    'abc.png'
  );
  assert.equal(response.status, 403);
  assert.equal(deleteFn.mock.callCount(), 0);
});

test('handleDelete allows admin auth without delete token verification', async () => {
  const deleteFn = mock.fn(async () => {});
  const env = createEnv({
    IMAGE_BUCKET: {
      head: async () => ({ customMetadata: { deleteToken: 'stored-token' } }),
      delete: deleteFn,
    },
  });

  const response = await handleDelete(
    request('DELETE', {
      Authorization: 'Bearer secret-token',
      'X-Delete-Token': 'wrong-token',
    }),
    env,
    'abc.png'
  );

  assert.equal(response.status, 200);
  assert.equal(deleteFn.mock.callCount(), 1);
});

test('handleBulkDelete validates body and max ids', async () => {
  const env = createEnv();

  const invalidJson = await handleBulkDelete(request('POST', {}, '{'), env);
  assert.equal(invalidJson.status, 400);

  const missingIds = await handleBulkDelete(
    request('POST', { 'Content-Type': 'application/json' }, JSON.stringify({})),
    env
  );
  assert.equal(missingIds.status, 400);

  const tooMany = await handleBulkDelete(
    request(
      'POST',
      { 'Content-Type': 'application/json' },
      JSON.stringify({ ids: Array.from({ length: 101 }, (_, i) => `id-${i}`) })
    ),
    env
  );
  assert.equal(tooMany.status, 400);
});

test('handleBulkDelete returns per-id result list', async () => {
  const deleteFn = mock.fn(async () => {});
  const env = createEnv({
    IMAGE_BUCKET: {
      head: async (key) => (key === 'images/id2.png' ? { key } : null),
      delete: deleteFn,
    },
  });

  const response = await handleBulkDelete(
    request(
      'POST',
      { 'Content-Type': 'application/json' },
      JSON.stringify({ ids: ['id1.png', 'id2.png'] })
    ),
    env
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.deepEqual(body.data.results, [
    { id: 'id1.png', deleted: false, error: 'not found' },
    { id: 'id2.png', deleted: true },
  ]);
  assert.equal(deleteFn.mock.callCount(), 1);
});
