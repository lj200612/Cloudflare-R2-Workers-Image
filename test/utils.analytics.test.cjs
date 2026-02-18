const test = require('node:test');
const assert = require('node:assert/strict');
const { mock } = require('node:test');

const { logRequest } = require('../.test-dist/src/utils/analytics.js');

test('logRequest works when env.ANALYTICS is undefined', () => {
  const env = {};
  // Should not throw
  assert.doesNotThrow(() => {
    logRequest(env, {
      method: 'GET',
      path: '/images/test.png',
      status: 200,
      durationMs: 12,
    });
  });
});

test('logRequest calls writeDataPoint with correct shape', () => {
  const writeDataPoint = mock.fn(() => {});
  const env = { ANALYTICS: { writeDataPoint } };

  logRequest(env, {
    method: 'POST',
    path: '/images',
    status: 201,
    durationMs: 45,
  });

  assert.equal(writeDataPoint.mock.callCount(), 1);
  const arg = writeDataPoint.mock.calls[0].arguments[0];
  assert.deepEqual(arg.blobs, ['POST', '/images', '']);
  assert.deepEqual(arg.doubles, [201, 45]);
  assert.deepEqual(arg.indexes, ['201']);
});

test('logRequest passes error string into blobs', () => {
  const writeDataPoint = mock.fn(() => {});
  const env = { ANALYTICS: { writeDataPoint } };

  logRequest(env, {
    method: 'GET',
    path: '/images/x.png',
    status: 500,
    durationMs: 3,
    error: 'boom',
  });

  assert.equal(writeDataPoint.mock.callCount(), 1);
  const arg = writeDataPoint.mock.calls[0].arguments[0];
  assert.equal(arg.blobs[2], 'boom');
});

test('logRequest swallows writeDataPoint errors', () => {
  const env = {
    ANALYTICS: {
      writeDataPoint() {
        throw new Error('analytics engine down');
      },
    },
  };

  // Must not throw
  assert.doesNotThrow(() => {
    logRequest(env, {
      method: 'GET',
      path: '/health',
      status: 200,
      durationMs: 1,
    });
  });
});
