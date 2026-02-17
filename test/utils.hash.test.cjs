const test = require('node:test');
const assert = require('node:assert/strict');

const {
  sha256Hex,
  contentHash,
  generateDeleteToken,
  hashIp,
} = require('../.test-dist/src/utils/hash.js');

test('sha256Hex matches known digest for abc', async () => {
  const data = new TextEncoder().encode('abc').buffer;
  const hex = await sha256Hex(data);
  assert.equal(hex, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('contentHash returns first 24 hex chars', async () => {
  const data = new TextEncoder().encode('abc').buffer;
  const hash = await contentHash(data);
  assert.equal(hash.length, 24);
  assert.equal(hash, 'ba7816bf8f01cfea414140de');
});

test('generateDeleteToken returns 32-hex token and is non-deterministic', async () => {
  const t1 = await generateDeleteToken('hash', '2026-01-01T00:00:00.000Z');
  const t2 = await generateDeleteToken('hash', '2026-01-01T00:00:00.000Z');

  assert.equal(t1.length, 32);
  assert.equal(t2.length, 32);
  assert.match(t1, /^[0-9a-f]{32}$/);
  assert.match(t2, /^[0-9a-f]{32}$/);
  assert.notEqual(t1, t2);
});

test('hashIp returns stable 16-hex hash', async () => {
  const h1 = await hashIp('1.2.3.4');
  const h2 = await hashIp('1.2.3.4');
  const h3 = await hashIp('8.8.8.8');

  assert.equal(h1.length, 16);
  assert.equal(h1, h2);
  assert.notEqual(h1, h3);
});
