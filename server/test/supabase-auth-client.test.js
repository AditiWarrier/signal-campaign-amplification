const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadSupabaseAuth(storage) {
  const source = fs.readFileSync(path.join(__dirname, '../../src/auth/supabase-auth.ts'), 'utf8');
  const module = { exports: {} };
  const testRequire = (name) => name === './session-storage' ? { sessionStorage: storage } : require(name);
  new Function('exports', 'require', 'module', ts.transpile(source, { module: ts.ModuleKind.CommonJS }))(
    module.exports,
    testRequire,
    module,
  );
  return module.exports;
}

test('forced access-token refresh persists the rotated Supabase session', async (t) => {
  const oldUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const oldFetch = global.fetch;
  t.after(() => {
    if (oldUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    else process.env.EXPO_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = oldKey;
    global.fetch = oldFetch;
  });

  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://signal-test.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-publishable-key';
  let persisted;
  const storage = {
    async read() { return persisted ?? null; },
    async write(value) { persisted = value; },
    async clear() { persisted = undefined; },
  };
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      json: async () => ({
        access_token: 'rotated-access-token',
        refresh_token: 'rotated-refresh-token',
        expires_in: 3600,
        user: { id: 'user-1', email: 'user@example.test' },
      }),
    };
  };

  const { refreshSession } = loadSupabaseAuth(storage);
  const original = {
    access_token: 'rejected-access-token',
    refresh_token: 'valid-refresh-token',
    expires_at: Math.floor(Date.now() / 1000) + 1800,
    user: { id: 'user-1', email: 'user@example.test' },
  };
  const refreshed = await refreshSession(original, true);

  assert.equal(request.url, 'https://signal-test.supabase.co/auth/v1/token?grant_type=refresh_token');
  assert.deepEqual(JSON.parse(request.options.body), { refresh_token: 'valid-refresh-token' });
  assert.equal(refreshed.access_token, 'rotated-access-token');
  assert.equal(refreshed.refresh_token, 'rotated-refresh-token');
  assert.equal(JSON.parse(persisted).access_token, 'rotated-access-token');
});

test('startup restoration validates a still-unexpired token with Supabase before retaining the signed-in session', async (t) => {
  const oldUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const oldFetch = global.fetch;
  t.after(() => {
    if (oldUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL; else process.env.EXPO_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY; else process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = oldKey;
    global.fetch = oldFetch;
  });
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://signal-test.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-key';
  const stored = { access_token: 'persisted-access', refresh_token: 'persisted-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'user-1', email: 'u@example.test' } };
  let persisted = JSON.stringify(stored);
  const storage = { async read() { return persisted; }, async write(value) { persisted = value; }, async clear() { persisted = undefined; } };
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ id: 'user-1', email: 'u@example.test' }) };
  };
  const { restoreSession } = loadSupabaseAuth(storage);
  const restored = await restoreSession();
  assert.equal(request.url, 'https://signal-test.supabase.co/auth/v1/user');
  assert.equal(request.options.headers.Authorization, 'Bearer persisted-access');
  assert.equal(restored.access_token, 'persisted-access');
  assert.equal(persisted, JSON.stringify(stored));
});

test('startup clears a definitively rejected session but preserves unvalidated data during Auth outages', async (t) => {
  const oldUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const oldFetch = global.fetch;
  t.after(() => {
    if (oldUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL; else process.env.EXPO_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY; else process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = oldKey;
    global.fetch = oldFetch;
  });
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://signal-test.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-key';
  const stored = { access_token: 'persisted-access', refresh_token: 'persisted-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: 'user-1', email: 'u@example.test' } };
  let persisted = JSON.stringify(stored);
  const storage = { async read() { return persisted; }, async write(value) { persisted = value; }, async clear() { persisted = undefined; } };
  const { restoreSession } = loadSupabaseAuth(storage);

  global.fetch = async () => ({ ok: false, status: 401, headers: { get: () => null }, json: async () => ({ msg: 'Invalid JWT', error_code: 'invalid_jwt' }) });
  assert.equal(await restoreSession(), null);
  assert.equal(persisted, undefined);

  persisted = JSON.stringify(stored);
  global.fetch = async () => { throw new TypeError('network unavailable'); };
  assert.equal(await restoreSession(), null);
  assert.equal(persisted, JSON.stringify(stored));
});

test('sign-in persists the issued session and sign-out clears it even when logout request fails', async (t) => {
  const oldUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const oldFetch = global.fetch;
  t.after(() => {
    if (oldUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL; else process.env.EXPO_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY; else process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = oldKey;
    global.fetch = oldFetch;
  });
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://signal-test.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-key';
  let persisted;
  const storage = { async read() { return persisted ?? null; }, async write(value) { persisted = value; }, async clear() { persisted = undefined; } };
  global.fetch = async (url) => url.endsWith('/token?grant_type=password')
    ? { ok: true, json: async () => ({ access_token: 'signed-in-access', refresh_token: 'signed-in-refresh', expires_in: 3600, user: { id: 'user-1', email: 'u@example.test' } }) }
    : { ok: false, status: 401, headers: { get: () => null }, json: async () => ({ msg: 'Session already ended.' }) };
  const { signInWithPassword, signOutSession } = loadSupabaseAuth(storage);
  const session = await signInWithPassword('u@example.test', 'a-password');
  assert.equal(JSON.parse(persisted).access_token, 'signed-in-access');
  await assert.rejects(signOutSession(session));
  assert.equal(persisted, undefined);
});

test('simultaneous refresh requests for one rotating refresh token share a single request', async (t) => {
  const oldUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const oldFetch = global.fetch;
  t.after(() => {
    if (oldUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL; else process.env.EXPO_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY; else process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = oldKey;
    global.fetch = oldFetch;
  });
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://signal-test.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-key';
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 10));
    return { ok: true, json: async () => ({ access_token: 'new-access', refresh_token: 'new-refresh', expires_in: 3600, user: { id: 'user-1', email: 'u@example.test' } }) };
  };
  const { refreshSession } = loadSupabaseAuth({ async write() {}, async read() { return null; }, async clear() {} });
  const original = { access_token: 'old-access', refresh_token: 'one-use-refresh', expires_at: 0, user: { id: 'user-1', email: 'u@example.test' } };
  const [first, second] = await Promise.all([refreshSession(original, true), refreshSession(original, true)]);
  assert.equal(calls, 1);
  assert.equal(first.access_token, 'new-access');
  assert.equal(second.access_token, 'new-access');
});

test('Supabase Auth refresh retains 429 status and Retry-After for Activity cooldown', async (t) => {
  const oldUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const oldKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const oldFetch = global.fetch;
  t.after(() => {
    if (oldUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL; else process.env.EXPO_PUBLIC_SUPABASE_URL = oldUrl;
    if (oldKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY; else process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = oldKey;
    global.fetch = oldFetch;
  });
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://signal-test.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'test-key';
  global.fetch = async () => ({ ok: false, status: 429, headers: { get: (name) => name === 'Retry-After' ? '9' : null }, json: async () => ({ msg: 'Request rate limit reached.', error_code: 'over_request_rate_limit' }) });
  const { refreshSession } = loadSupabaseAuth({ async write() {}, async read() { return null; }, async clear() {} });
  await assert.rejects(refreshSession({ access_token: 'a', refresh_token: 'r', expires_at: 0, user: { id: 'u', email: 'u@example.test' } }, true), (error) => {
    assert.equal(error.status, 429);
    assert.equal(error.code, 'over_request_rate_limit');
    assert.equal(error.retryAfterMs, 9000);
    return true;
  });
});
