const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

function loadSignalApi() {
  const source = fs.readFileSync(path.join(__dirname, '../../src/data/signal-api.ts'), 'utf8');
  const module = { exports: {} };
  const imports = {
    '@/types/local-campaign': { normalizeLocalCampaignDraft: (value) => value },
  };
  const testRequire = (name) => Object.hasOwn(imports, name) ? imports[name] : require(name);
  new Function('exports', 'require', 'module', ts.transpile(source, { module: ts.ModuleKind.CommonJS }))(
    module.exports,
    testRequire,
    module,
  );
  return module.exports;
}

test('Activity client returns API events and preserves local/API merge identity fields', async (t) => {
  const oldUrl = process.env.EXPO_PUBLIC_SIGNAL_API_URL;
  const oldFetch = global.fetch;
  t.after(() => {
    if (oldUrl === undefined) delete process.env.EXPO_PUBLIC_SIGNAL_API_URL;
    else process.env.EXPO_PUBLIC_SIGNAL_API_URL = oldUrl;
    global.fetch = oldFetch;
  });

  process.env.EXPO_PUBLIC_SIGNAL_API_URL = 'http://signal-api.test/';
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, json: async () => ({ events: [{
      id: 'event-1', eventType: 'campaign.submitted', campaignId: 'campaign-1',
      campaignTitle: 'Community garden', metadata: { campaignClientId: 'campaign-1' }, createdAt: '2026-10-18T00:00:00Z',
    }] }) };
  };

  const { getSignalActivity } = loadSignalApi();
  const events = await getSignalActivity('account-access-token');
  assert.equal(request.url, 'http://signal-api.test/api/activity');
  assert.equal(request.options.headers.Authorization, 'Bearer account-access-token');
  assert.equal(events.length, 1);
  assert.equal(events[0].campaignId, 'campaign-1');
  assert.equal(events[0].eventType, 'campaign.submitted');
});

test('Activity client exposes HTTP/auth/schema errors instead of calling them offline', async (t) => {
  const oldUrl = process.env.EXPO_PUBLIC_SIGNAL_API_URL;
  const oldFetch = global.fetch;
  t.after(() => {
    if (oldUrl === undefined) delete process.env.EXPO_PUBLIC_SIGNAL_API_URL;
    else process.env.EXPO_PUBLIC_SIGNAL_API_URL = oldUrl;
    global.fetch = oldFetch;
  });

  process.env.EXPO_PUBLIC_SIGNAL_API_URL = 'http://signal-api.test';
  global.fetch = async () => ({
    ok: false,
    status: 503,
    json: async () => ({ error: { code: 'CAMPAIGN_SCHEMA_NOT_READY', message: 'Apply the pending Supabase migrations.' } }),
  });
  const { getSignalActivity } = loadSignalApi();
  await assert.rejects(getSignalActivity('account-access-token'), /HTTP 503 CAMPAIGN_SCHEMA_NOT_READY: Apply the pending Supabase migrations/);

  global.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(getSignalActivity('account-access-token'), /Network request to the SIGNAL API failed: Failed to fetch/);
});

test('Activity client preserves a genuine API 429 and Retry-After without retrying it', async (t) => {
  const oldUrl = process.env.EXPO_PUBLIC_SIGNAL_API_URL;
  const oldFetch = global.fetch;
  t.after(() => {
    if (oldUrl === undefined) delete process.env.EXPO_PUBLIC_SIGNAL_API_URL;
    else process.env.EXPO_PUBLIC_SIGNAL_API_URL = oldUrl;
    global.fetch = oldFetch;
  });
  process.env.EXPO_PUBLIC_SIGNAL_API_URL = 'http://signal-api.test';
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return { ok: false, status: 429, headers: { get: (name) => name === 'Retry-After' ? '17' : null }, json: async () => ({ error: { code: 'AUTH_RATE_LIMITED', message: 'Request rate limit reached.' } }) };
  };
  const { getSignalActivityWithRefresh } = loadSignalApi();
  let refreshes = 0;
  await assert.rejects(getSignalActivityWithRefresh('token', async () => { refreshes += 1; return 'new-token'; }), (error) => {
    assert.equal(error.status, 429);
    assert.equal(error.code, 'AUTH_RATE_LIMITED');
    assert.equal(error.retryAfterMs, 17_000);
    return true;
  });
  assert.equal(calls, 1);
  assert.equal(refreshes, 0);
});

test('Activity retries once with the refreshed access token after a 401', async (t) => {
  const oldUrl = process.env.EXPO_PUBLIC_SIGNAL_API_URL;
  const oldFetch = global.fetch;
  t.after(() => {
    if (oldUrl === undefined) delete process.env.EXPO_PUBLIC_SIGNAL_API_URL;
    else process.env.EXPO_PUBLIC_SIGNAL_API_URL = oldUrl;
    global.fetch = oldFetch;
  });

  process.env.EXPO_PUBLIC_SIGNAL_API_URL = 'http://signal-api.test';
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    if (requests.length === 1) return {
      ok: false, status: 401,
      json: async () => ({ error: { code: 'INVALID_SESSION', message: 'Session rejected.', diagnostic: 'expired_token' } }),
    };
    return { ok: true, status: 200, json: async () => ({ events: [] }) };
  };

  const { getSignalActivityWithRefresh } = loadSignalApi();
  let refreshCalls = 0;
  await getSignalActivityWithRefresh('expired-access-token', async (rejectedToken) => {
    refreshCalls += 1;
    assert.equal(rejectedToken, 'expired-access-token');
    return 'rotated-access-token';
  });

  assert.equal(refreshCalls, 1);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].options.headers.Authorization, 'Bearer expired-access-token');
  assert.equal(requests[1].options.headers.Authorization, 'Bearer rotated-access-token');
});
