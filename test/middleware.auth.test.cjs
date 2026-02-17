const test = require('node:test');
const assert = require('node:assert/strict');

const { verifyAuth } = require('../.test-dist/src/middleware/auth.js');
const { createEnv } = require('../test-support/helpers.cjs');

function requestWithAuth(value) {
  const headers = {};
  if (value !== undefined) headers.Authorization = value;
  return new Request('https://example.com', { headers });
}

test('verifyAuth rejects missing or malformed auth header', async () => {
  const env = createEnv();

  const missing = verifyAuth(requestWithAuth(undefined), env);
  const malformed = verifyAuth(requestWithAuth('Token abc'), env);

  assert.equal(missing.status, 401);
  assert.equal((await missing.json()).error, 'Missing or invalid Authorization header');
  assert.equal(malformed.status, 401);
});

test('verifyAuth rejects invalid token', async () => {
  const env = createEnv({ API_TOKEN: 'secret-token' });

  const wrong = verifyAuth(requestWithAuth('Bearer wrong-token'), env);
  const short = verifyAuth(requestWithAuth('Bearer x'), env);

  assert.equal(wrong.status, 401);
  assert.equal((await wrong.json()).error, 'Invalid API token');
  assert.equal(short.status, 401);
});

test('verifyAuth passes with valid bearer token', () => {
  const env = createEnv({ API_TOKEN: 'secret-token' });
  const ok = verifyAuth(requestWithAuth('Bearer secret-token'), env);
  assert.equal(ok, null);
});
