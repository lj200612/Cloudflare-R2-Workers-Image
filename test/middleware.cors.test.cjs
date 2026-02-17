const test = require('node:test');
const assert = require('node:assert/strict');

const { corsHeaders, handleOptions } = require('../.test-dist/src/middleware/cors.js');
const { createEnv } = require('../test-support/helpers.cjs');

test('corsHeaders allows wildcard origin', () => {
  const env = createEnv({ ALLOWED_ORIGINS: '*' });
  const request = new Request('https://example.com', {
    headers: { Origin: 'https://foo.com' },
  });

  const headers = corsHeaders(request, env);
  assert.equal(headers['Access-Control-Allow-Origin'], '*');
});

test('corsHeaders only allows configured origins', () => {
  const env = createEnv({ ALLOWED_ORIGINS: 'https://a.com, https://b.com' });
  const allowedRequest = new Request('https://example.com', {
    headers: { Origin: 'https://b.com' },
  });
  const blockedRequest = new Request('https://example.com', {
    headers: { Origin: 'https://x.com' },
  });

  assert.equal(corsHeaders(allowedRequest, env)['Access-Control-Allow-Origin'], 'https://b.com');
  assert.equal(corsHeaders(blockedRequest, env)['Access-Control-Allow-Origin'], '');
});

test('handleOptions returns 204 with CORS headers', () => {
  const env = createEnv({ ALLOWED_ORIGINS: '*' });
  const request = new Request('https://example.com', { method: 'OPTIONS' });
  const response = handleOptions(request, env);

  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  assert.equal(response.headers.get('Access-Control-Allow-Methods'), 'GET, POST, DELETE, OPTIONS');
});
