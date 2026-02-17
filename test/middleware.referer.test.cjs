const test = require('node:test');
const assert = require('node:assert/strict');

const { checkReferer } = require('../.test-dist/src/middleware/referer.js');
const { createEnv } = require('../test-support/helpers.cjs');

test('checkReferer allows when no restriction configured', () => {
  const env = createEnv({ ALLOWED_REFERERS: '' });
  const request = new Request('https://example.com');
  assert.equal(checkReferer(request, env), null);
});

test('checkReferer handles missing referer based on ALLOW_EMPTY_REFERER', () => {
  const request = new Request('https://example.com');

  const allowed = checkReferer(
    request,
    createEnv({ ALLOWED_REFERERS: 'example.com', ALLOW_EMPTY_REFERER: 'true' })
  );
  const blocked = checkReferer(
    request,
    createEnv({ ALLOWED_REFERERS: 'example.com', ALLOW_EMPTY_REFERER: 'false' })
  );

  assert.equal(allowed, null);
  assert.equal(blocked.status, 403);
});

test('checkReferer rejects invalid referer URL', () => {
  const env = createEnv({ ALLOWED_REFERERS: 'example.com' });
  const request = new Request('https://example.com', { headers: { Referer: 'not a url' } });
  const response = checkReferer(request, env);

  assert.equal(response.status, 403);
});

test('checkReferer allows exact and wildcard domains', () => {
  const env = createEnv({ ALLOWED_REFERERS: 'example.com,*.foo.com' });

  const exact = new Request('https://example.com', {
    headers: { Referer: 'https://example.com/page' },
  });
  const wildcard = new Request('https://example.com', {
    headers: { Referer: 'https://img.bar.foo.com/p.png' },
  });
  const blocked = new Request('https://example.com', {
    headers: { Referer: 'https://evil.com/p.png' },
  });

  assert.equal(checkReferer(exact, env), null);
  assert.equal(checkReferer(wildcard, env), null);
  assert.equal(checkReferer(blocked, env).status, 403);
});
