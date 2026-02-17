const test = require('node:test');
const assert = require('node:assert/strict');

const { handleList } = require('../.test-dist/src/handlers/list.js');
const { handleInfo } = require('../.test-dist/src/handlers/info.js');
const { createEnv } = require('../test-support/helpers.cjs');

test('handleList maps objects and supports pagination cursor', async () => {
  const env = createEnv({
    BASE_URL: 'https://cdn.test',
    IMAGE_BUCKET: {
      list: async (opts) => {
        assert.equal(opts.limit, 20);
        assert.equal(opts.cursor, 'abc');
        return {
          objects: [
            {
              key: 'images/hash1.png',
              size: 11,
              uploaded: new Date('2026-01-01T00:00:00.000Z'),
              customMetadata: {
                originalName: 'a.png',
                uploadedAt: '2026-01-01T00:00:00.000Z',
              },
            },
            {
              key: 'images/hash2.unknown',
              size: 22,
              uploaded: new Date('2026-01-02T00:00:00.000Z'),
              customMetadata: {},
            },
          ],
          truncated: true,
          cursor: 'next-cursor',
        };
      },
    },
  });

  const response = await handleList(
    new Request('https://api.test/images?limit=20&cursor=abc'),
    env
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.images.length, 2);
  assert.equal(body.data.images[0].url, 'https://cdn.test/images/hash1.png');
  assert.equal(body.data.cursor, 'next-cursor');
  assert.equal(body.data.hasMore, true);
});

test('handleList clamps limit to [1,100]', async () => {
  let receivedLimit = 0;
  const env = createEnv({
    IMAGE_BUCKET: {
      list: async (opts) => {
        receivedLimit = opts.limit;
        return { objects: [], truncated: false };
      },
    },
  });

  await handleList(new Request('https://api.test/images?limit=999'), env);
  assert.equal(receivedLimit, 100);

  await handleList(new Request('https://api.test/images?limit=-1'), env);
  assert.equal(receivedLimit, 1);
});

test('handleInfo returns 404 when key/object missing', async () => {
  const notFoundEnv = createEnv({
    IMAGE_BUCKET: {
      head: async () => null,
    },
  });
  const notFound = await handleInfo(new Request('https://api.test/images/x/info'), notFoundEnv, 'x.png');
  assert.equal(notFound.status, 404);

  let headCall = 0;
  const missingHeadEnv = createEnv({
    IMAGE_BUCKET: {
      head: async () => {
        headCall += 1;
        return headCall === 1 ? { key: 'images/x.png' } : null;
      },
    },
  });
  const missing = await handleInfo(new Request('https://api.test/images/x/info'), missingHeadEnv, 'x.png');
  assert.equal(missing.status, 404);
});

test('handleInfo returns normalized image metadata', async () => {
  let headCall = 0;
  const env = createEnv({
    BASE_URL: 'https://cdn.test',
    IMAGE_BUCKET: {
      head: async () => {
        headCall += 1;
        if (headCall === 1) {
          return { key: 'images/hash.png' };
        }
        return {
          size: 123,
          uploaded: new Date('2026-01-05T00:00:00.000Z'),
          customMetadata: {
            originalName: 'demo.png',
            uploadedAt: '2026-01-05T00:00:00.000Z',
          },
        };
      },
    },
  });

  const response = await handleInfo(new Request('https://api.test/images/hash/info'), env, 'hash.png');
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.data.id, 'hash.png');
  assert.equal(body.data.url, 'https://cdn.test/images/hash.png');
  assert.equal(body.data.type, 'image/png');
});
