function createMockBucket(overrides = {}) {
  return {
    head: async () => null,
    get: async () => null,
    put: async () => ({}),
    delete: async () => {},
    list: async () => ({ objects: [], truncated: false }),
    ...overrides,
  };
}

function createRateLimiterNamespace(fetchImpl) {
  const calls = {
    names: [],
    ids: [],
  };

  const stub = {
    fetch:
      fetchImpl ||
      (async () =>
        new Response(JSON.stringify({ allowed: true, retryAfter: 0 }), {
          headers: { 'Content-Type': 'application/json' },
        })),
  };

  return {
    calls,
    namespace: {
      idFromName(name) {
        calls.names.push(name);
        return `id:${name}`;
      },
      get(id) {
        calls.ids.push(id);
        return stub;
      },
    },
  };
}

function createEnv(overrides = {}) {
  const { namespace } = createRateLimiterNamespace();
  return {
    IMAGE_BUCKET: createMockBucket(),
    RATE_LIMITER: namespace,
    API_TOKEN: 'secret-token',
    ALLOWED_REFERERS: '',
    ALLOW_EMPTY_REFERER: 'true',
    MAX_FILE_SIZE: String(5 * 1024 * 1024),
    ALLOWED_ORIGINS: '*',
    BASE_URL: '',
    ENABLE_IMAGE_RESIZING: 'false',
    RATE_LIMIT_UPLOADS_PER_MINUTE: '10',
    RATE_LIMIT_REQUESTS_PER_MINUTE: '60',
    ...overrides,
  };
}

module.exports = {
  createMockBucket,
  createRateLimiterNamespace,
  createEnv,
};
