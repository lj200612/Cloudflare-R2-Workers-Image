const test = require('node:test');
const assert = require('node:assert/strict');

const { detectImageType } = require('../.test-dist/src/services/image.js');

function toArrayBuffer(bytes) {
  return Uint8Array.from(bytes).buffer;
}

test('detectImageType detects jpeg/png/gif/webp', () => {
  const jpeg = [0xff, 0xd8, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
  const gif = [0x47, 0x49, 0x46, 0x38, 0, 0, 0, 0, 0, 0, 0, 0];
  const webp = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];

  assert.deepEqual(detectImageType(toArrayBuffer(jpeg)), { mime: 'image/jpeg', ext: 'jpg' });
  assert.deepEqual(detectImageType(toArrayBuffer(png)), { mime: 'image/png', ext: 'png' });
  assert.deepEqual(detectImageType(toArrayBuffer(gif)), { mime: 'image/gif', ext: 'gif' });
  assert.deepEqual(detectImageType(toArrayBuffer(webp)), { mime: 'image/webp', ext: 'webp' });
});

test('detectImageType rejects short or unknown payloads', () => {
  const short = [0xff, 0xd8, 0xff];
  const unknown = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  assert.equal(detectImageType(toArrayBuffer(short)), null);
  assert.equal(detectImageType(toArrayBuffer(unknown)), null);
});

test('detectImageType rejects RIFF that is not WEBP', () => {
  const riffButNotWebp = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x41, 0x42, 0x43, 0x44];
  assert.equal(detectImageType(toArrayBuffer(riffButNotWebp)), null);
});
