const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseMaxFileSize,
  parseBoolean,
  parsePositiveInt,
  sanitizeFilename,
} = require('../.test-dist/src/utils/validation.js');

test('parseMaxFileSize uses default for empty/invalid values', () => {
  assert.equal(parseMaxFileSize(undefined), 5 * 1024 * 1024);
  assert.equal(parseMaxFileSize('abc'), 5 * 1024 * 1024);
  assert.equal(parseMaxFileSize('-1'), 5 * 1024 * 1024);
});

test('parseMaxFileSize returns parsed positive value', () => {
  assert.equal(parseMaxFileSize('1024'), 1024);
});

test('parseBoolean handles defaults and supported truthy values', () => {
  assert.equal(parseBoolean(undefined, true), true);
  assert.equal(parseBoolean(undefined, false), false);
  assert.equal(parseBoolean('true'), true);
  assert.equal(parseBoolean('TRUE'), true);
  assert.equal(parseBoolean('1'), true);
  assert.equal(parseBoolean('false'), false);
});

test('parsePositiveInt handles defaults and valid values', () => {
  assert.equal(parsePositiveInt(undefined, 12), 12);
  assert.equal(parsePositiveInt('0', 12), 12);
  assert.equal(parsePositiveInt('-9', 12), 12);
  assert.equal(parsePositiveInt('x', 12), 12);
  assert.equal(parsePositiveInt('15', 12), 15);
});

test('sanitizeFilename replaces unsafe characters and caps length', () => {
  assert.equal(sanitizeFilename('a<bad>:name?.png'), 'a_bad__name_.png');

  const long = 'a'.repeat(300);
  assert.equal(sanitizeFilename(long).length, 255);
});
