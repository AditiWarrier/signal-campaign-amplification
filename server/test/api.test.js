const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createServer } = require('node:http');
const { createApp, validateCampaignInput } = require('../app');
const { createSupabaseAuth, createAuthMiddleware } = require('../auth');
const { JsonStore, MemoryStore } = require('../store');

const creator = { id: 'user-creator', email: 'creator@example.test', user_metadata: { role: 'admin' }, app_metadata: {} };
const supporter = { id: 'user-supporter', email: 'supporter@example.test', user_metadata: {}, app_metadata: {} };
const reviewer = { id: 'user-reviewer', email: 'reviewer@example.test', user_metadata: {}, app_metadata: { role: 'reviewer' } };
const usersByToken = { creator_token: creator, supporter_token: supporter, reviewer_token: reviewer };

const completeDraft = {
  title: 'A community story', category: 'Community', creatorName: 'Fictional Community Group', summary: 'A demo campaign summary.',
  coverUri: '', coverAlt: '', storyHeadline: 'A story headline', introduction: 'A longer introduction to this community campaign.',
  sections: [{ id: 'section-1', heading: 'What is happening', body: 'This campaign shares a fictional community story.' }],
  sources: [{ id: 'source-1', title: 'Community information', url: 'https://example.test/community' }], audienceActions: 'Share the story.',
  adHeadline: 'Learn more', adDescription: 'A fictional campaign description.', callToAction: 'Learn more', adImageUri: '', adImageAlt: '', adImageMetadata: '',
  locations: ['Canada'], minimumAge: '18', maximumAge: '', interests: 'Community', channels: ['instagram'], durationDays: '14',
  instagramBudget: '20', facebookBudget: '', fundingGoal: '100', policyAccepted: true,
};

test('Supabase access-token verification uses the Auth user GET endpoint', async () => {
  let captured;
  const auth = createSupabaseAuth({
    url: 'https://example.supabase.co',
    publishableKey: 'test-publishable-key',
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return { ok: true, json: async () => ({ id: 'user-1', email: 'user@example.test' }) };
    },
  });
  const user = await auth.verifyAccessToken('test-access-token');
  assert.equal(user.id, 'user-1');
  assert.equal(captured.url, 'https://example.supabase.co/auth/v1/user');
  assert.equal(captured.options.method, 'GET');
  assert.equal(captured.options.headers.Authorization, 'Bearer test-access-token');
  assert.equal('body' in captured.options, false);
});

test('access-token diagnostics distinguish malformed, expired, wrong-project, and candidate JWTs', () => {
  const auth = createSupabaseAuth({ url: 'https://signal-test.supabase.co', publishableKey: 'test-key' });
  const tokenFor = (claims) => `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
  const validClaims = { iss: 'https://signal-test.supabase.co/auth/v1', exp: Math.floor(Date.now() / 1000) + 300 };
  assert.equal(auth.inspectAccessToken(''), 'missing_token');
  assert.equal(auth.inspectAccessToken('not-a-jwt'), 'malformed_token');
  assert.equal(auth.inspectAccessToken(tokenFor({ ...validClaims, iss: 'https://other.supabase.co/auth/v1' })), 'wrong_project_or_issuer');
  assert.equal(auth.inspectAccessToken(tokenFor({ ...validClaims, exp: 1 })), 'expired_token');
  assert.equal(auth.inspectAccessToken(tokenFor(validClaims)), 'candidate');
});

test('auth middleware reports Supabase verification outages instead of mislabeling them as invalid sessions', async () => {
  const auth = createSupabaseAuth({
    url: 'https://signal-test.supabase.co',
    publishableKey: 'test-key',
    fetchImpl: async () => { throw new Error('network unavailable'); },
  });
  const middleware = createAuthMiddleware(auth);
  const claims = { iss: 'https://signal-test.supabase.co/auth/v1', exp: Math.floor(Date.now() / 1000) + 300 };
  const token = `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
  let status;
  let body;
  const response = {
    status(value) { status = value; return this; },
    json(value) { body = value; return this; },
  };
  await middleware({ get: () => `Bearer ${token}` }, response, () => assert.fail('next must not run when verification is unavailable'));
  assert.equal(status, 502);
  assert.equal(body.error.code, 'AUTH_VERIFICATION_UNAVAILABLE');
  assert.equal(body.error.diagnostic, 'verification_unavailable');
  assert.doesNotMatch(JSON.stringify(body), new RegExp(token));
});

test('auth middleware preserves Supabase Auth rate limits and Retry-After', async () => {
  const auth = createSupabaseAuth({
    url: 'https://signal-test.supabase.co', publishableKey: 'test-key',
    fetchImpl: async () => ({ ok: false, status: 429, headers: { get: (name) => name === 'Retry-After' ? '23' : null }, json: async () => ({ msg: 'Request rate limit reached.', error_code: 'over_request_rate_limit' }) }),
  });
  const middleware = createAuthMiddleware(auth);
  const claims = { iss: 'https://signal-test.supabase.co/auth/v1', exp: Math.floor(Date.now() / 1000) + 300 };
  const token = `e30.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
  let status;
  let body;
  let retryAfter;
  const response = {
    setHeader(name, value) { if (name === 'Retry-After') retryAfter = value; return this; },
    status(value) { status = value; return this; },
    json(value) { body = value; return this; },
  };
  await middleware({ get: () => `Bearer ${token}` }, response, () => assert.fail('next must not run when Auth rate limits verification'));
  assert.equal(status, 429);
  assert.equal(body.error.code, 'AUTH_RATE_LIMITED');
  assert.equal(body.error.message, 'Request rate limit reached.');
  assert.equal(retryAfter, '23');
});

async function withApi(t, store = new MemoryStore(), campaigns) {
  const auth = {
    async verifyAccessToken(token) {
      const user = usersByToken[token];
      if (!user) throw new Error('invalid');
      return user;
    },
    async signIn(email) { return { access_token: 'test-token', user: { email } }; },
    async signUp(name, email) { return { user: { name, email }, session: null }; },
  };
  const server = createServer(createApp({ store, campaigns, auth }));
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const request = async (route, { token, method = 'GET', body, headers = {} } = {}) => {
    const response = await fetch(`http://127.0.0.1:${port}${route}`, {
      method,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = response.status === 204 ? null : await response.json();
    return { status: response.status, data };
  };
  return { request };
}

test('Supabase campaign routes preserve ownership and return submitted account Activity', async (t) => {
  const saved = new Map();
  const events = [];
  let submissionCalls = 0;
  const campaigns = {
    async saveDraft(id, ownerId, data) {
      const existing = saved.get(id);
      if (existing && existing.ownerId !== ownerId) {
        const error = new Error('Campaign was not found.'); error.status = 404; throw error;
      }
      const item = existing || { id, ownerId, status: 'draft', createdAt: '2026-10-18T00:00:00Z' };
      Object.assign(item, { data, updatedAt: '2026-10-18T00:00:00Z' });
      saved.set(id, item);
      return item;
    },
    async getCampaign(id) { return saved.get(id) || null; },
    async listCampaigns(_token, ownerId, mine) { return [...saved.values()].filter((item) => !mine || item.ownerId === ownerId); },
    async submitCampaign(id) {
      submissionCalls += 1;
      const item = saved.get(id);
      if (item.status === 'draft') {
        item.status = 'submitted';
        if (!events.some((event) => event.campaignId === id && event.eventType === 'campaign.submitted')) {
          events.push({ id: 'event-submission', userId: item.ownerId, campaignId: id, eventType: 'campaign.submitted', metadata: { campaignTitle: item.data.title }, createdAt: '2026-10-18T00:00:01Z' });
        }
      }
      return item;
    },
    async listActivity(token) { return events.filter((event) => event.userId === (token === 'creator_token' ? creator.id : supporter.id)); },
  };
  const { request } = await withApi(t, new MemoryStore(), campaigns);
  const created = await request('/api/drafts/local-campaign-1', { token: 'creator_token', method: 'PUT', body: completeDraft });
  assert.equal(created.status, 200);
  assert.equal(created.data.draft.ownerId, creator.id);
  assert.equal((await request('/api/drafts/local-campaign-1', { token: 'supporter_token', method: 'PATCH', body: completeDraft })).status, 404);
  const submitted = await request('/api/campaigns/local-campaign-1/submit', { token: 'creator_token', method: 'POST', body: { policyAccepted: true } });
  assert.equal(submitted.data.campaign.status, 'submitted');
  assert.equal((await request('/api/campaigns/local-campaign-1/submit', { token: 'creator_token', method: 'POST', body: { policyAccepted: true } })).data.campaign.status, 'submitted');
  const activity = (await request('/api/activity', { token: 'creator_token' })).data.events;
  assert.equal(activity.length, 1);
  assert.equal(activity[0].eventType, 'campaign.submitted');
  assert.equal((await request('/api/activity', { token: 'supporter_token' })).data.events.length, 0);
  assert.equal(submissionCalls, 1);
  assert.equal(events.filter((event) => event.userId === creator.id && event.eventType === 'campaign.submitted').length, 1);
});

test('a failed Supabase submission does not report success or create account Activity', async (t) => {
  const calls = [];
  const campaigns = {
    async getCampaign(id) { return { id, ownerId: creator.id, status: 'draft', data: validateCampaignInput(completeDraft) }; },
    async submitCampaign() { calls.push('submit'); const error = new Error('database unavailable'); error.status = 503; throw error; },
    async listActivity() { calls.push('activity'); return []; },
  };
  const { request } = await withApi(t, new MemoryStore(), campaigns);
  const result = await request('/api/campaigns/local-campaign-atomic/submit', {
    token: 'creator_token', method: 'POST', body: { policyAccepted: true },
  });
  assert.equal(result.status, 503);
  assert.equal(result.data.error.message, 'database unavailable');
  assert.deepEqual(calls, ['submit']);
});

test('an unconfirmed Supabase submission response cannot be reported as successful', async (t) => {
  const campaigns = {
    async getCampaign(id) { return { id, ownerId: creator.id, status: 'draft', data: validateCampaignInput(completeDraft) }; },
    async submitCampaign(id) { return { id, ownerId: creator.id, status: 'draft', data: validateCampaignInput(completeDraft) }; },
  };
  const { request } = await withApi(t, new MemoryStore(), campaigns);
  const result = await request('/api/campaigns/local-campaign-unconfirmed/submit', {
    token: 'creator_token', method: 'POST', body: { policyAccepted: true },
  });
  assert.equal(result.status, 502);
  assert.equal(result.data.error.code, 'SUBMISSION_UNCONFIRMED');
});

test('health and Supabase auth proxy routes validate requests', async (t) => {
  const { request } = await withApi(t);
  assert.deepEqual((await request('/api/health')).data, { ok: true, service: 'signal-api', persistence: 'backend-file' });
  assert.equal((await request('/api/auth/me')).status, 401);
  assert.equal((await request('/api/auth/login', { method: 'POST', body: { email: 'bad', password: 'short' } })).status, 400);
  const login = await request('/api/auth/login', { method: 'POST', body: { email: 'creator@example.test', password: 'pass12345' } });
  assert.equal(login.status, 200);
  assert.equal(login.data.access_token, 'test-token');
  const signup = await request('/api/auth/signup', { method: 'POST', body: { name: 'A new creator', email: 'new@example.test', password: 'pass12345' } });
  assert.equal(signup.status, 201);
  const me = await request('/api/auth/me', { token: 'creator_token' });
  assert.equal(me.data.user.id, creator.id);
  assert.equal(me.data.user.role, 'user'); // user_metadata role is not trusted
});

test('campaigns and drafts validate, persist, and enforce owner checks', async (t) => {
  const { request } = await withApi(t);
  const synced = await request('/api/drafts/device-draft-1', { token: 'creator_token', method: 'PUT', body: completeDraft });
  assert.equal(synced.status, 200);
  assert.equal(synced.data.draft.id, 'device-draft-1');
  assert.equal((await request('/api/drafts', { token: 'creator_token' })).data.drafts[0].data.title, completeDraft.title);
  assert.equal((await request('/api/drafts/device-draft-1', { token: 'supporter_token', method: 'PUT', body: completeDraft })).status, 404);
  const invalid = await request('/api/drafts', { token: 'creator_token', method: 'POST', body: { ...completeDraft, sources: [{ title: 'Bad source', url: 'javascript:alert(1)' }] } });
  assert.equal(invalid.status, 400);
  const created = await request('/api/drafts', { token: 'creator_token', method: 'POST', body: completeDraft });
  assert.equal(created.status, 201);
  const id = created.data.draft.id;
  assert.equal(created.data.draft.ownerId, creator.id);
  assert.equal((await request('/api/drafts', { token: 'supporter_token' })).data.drafts.length, 0);
  assert.equal((await request(`/api/drafts/${id}`, { token: 'supporter_token' })).status, 404);
  assert.equal((await request(`/api/drafts/${id}`, { token: 'creator_token' })).data.draft.data.storyHeadline, completeDraft.storyHeadline);
  const patched = await request(`/api/drafts/${id}`, { token: 'creator_token', method: 'PATCH', body: { ...completeDraft, summary: 'Updated while draft.' } });
  assert.equal(patched.data.draft.data.summary, 'Updated while draft.');
  assert.equal((await request(`/api/campaigns/${id}`, { token: 'supporter_token' })).status, 404);
  assert.equal((await request('/api/campaigns', { token: 'creator_token', method: 'POST', body: completeDraft })).status, 201);
  const creatorActivity = (await request('/api/activity', { token: 'creator_token' })).data.events;
  assert.equal(creatorActivity.some((event) => event.eventType === 'campaign.draft_created'), true);
  assert.equal(creatorActivity.every((event) => event.userId === creator.id), true);
  assert.equal((await request('/api/activity', { token: 'supporter_token' })).data.events.length, 0);
});

test('submission, reviewer permissions, simulated contribution, activity and reports work end-to-end', async (t) => {
  const { request } = await withApi(t);
  const created = await request('/api/campaigns', { token: 'creator_token', method: 'POST', body: completeDraft });
  const id = created.data.campaign.id;
  const noPolicy = await request(`/api/campaigns/${id}/submit`, { token: 'creator_token', method: 'POST', body: { policyAccepted: false } });
  assert.equal(noPolicy.status, 400);
  const submitted = await request(`/api/campaigns/${id}/submit`, { token: 'creator_token', method: 'POST', body: { policyAccepted: true } });
  assert.equal(submitted.data.campaign.status, 'submitted');
  const creatorEvents = (await request('/api/activity', { token: 'creator_token' })).data.events;
  assert.equal(creatorEvents.some((event) => event.eventType === 'campaign.submitted' && event.campaignId === id), true);
  assert.equal(creatorEvents.filter((event) => event.eventType === 'campaign.submitted' && event.campaignId === id).length, 1);
  assert.equal((await request(`/api/campaigns/${id}`, { token: 'creator_token' })).data.campaign.status, 'submitted');
  assert.equal((await request('/api/activity', { token: 'creator_token' })).data.events.filter((event) => event.eventType === 'campaign.submitted' && event.campaignId === id).length, 1);
  assert.equal((await request(`/api/reviews/${id}/status`, { token: 'creator_token', method: 'POST', body: { status: 'approved' } })).status, 403);
  assert.equal((await request(`/api/reviews/${id}/status`, { token: 'reviewer_token', method: 'POST', body: { status: 'not-a-status' } })).status, 400);
  assert.equal((await request(`/api/reviews/${id}/status`, { token: 'reviewer_token', method: 'POST', body: { status: 'under_review', feedback: 'Reviewed against the demo checklist.' } })).data.campaign.status, 'under_review');
  assert.equal((await request(`/api/reviews/${id}/status`, { token: 'reviewer_token', method: 'POST', body: { status: 'approved', feedback: 'Approved for the fictional demo.' } })).data.campaign.status, 'approved');
  const selfContribution = await request('/api/demo/contributions', { token: 'creator_token', method: 'POST', body: { campaignId: id, amountMinor: 500, currency: 'USD', idempotencyKey: 'self-contribution-1' } });
  assert.equal(selfContribution.status, 403);
  const body = { campaignId: id, amountMinor: 1000, currency: 'USD', idempotencyKey: 'supporter-payment-1' };
  const contribution = await request('/api/demo/contributions', { token: 'supporter_token', method: 'POST', body });
  assert.equal(contribution.status, 201);
  assert.equal(contribution.data.simulated, true);
  assert.equal(contribution.data.actualPaymentProcessed, false);
  const duplicate = await request('/api/demo/contributions', { token: 'supporter_token', method: 'POST', body });
  assert.equal(duplicate.data.contribution.id, contribution.data.contribution.id);
  const totals = await request(`/api/campaigns/${id}/contributions`, { token: 'creator_token' });
  assert.equal(totals.data.fundingGoalMinor, 10000);
  assert.equal(totals.data.simulatedRaisedMinor, 1000);
  assert.equal(totals.data.remainingMinor, 9000);
  assert.equal(totals.data.fundingPercentage, 10);
  assert.equal(totals.data.contributionType, 'simulated_only');
  assert.equal(totals.data.simulatedContributionCount, 1);
  assert.equal(totals.data.verifiedRaisedMinor, 0);
  assert.equal((await request('/api/contributions', { token: 'supporter_token', method: 'POST', body: { amountMinor: 1000 } })).status, 501);
  assert.equal((await request('/api/activity', { token: 'supporter_token' })).data.events.some((event) => event.eventType === 'contribution.simulated'), true);
  const supporterEvents = (await request('/api/activity', { token: 'supporter_token' })).data.events;
  assert.equal(supporterEvents.filter((event) => event.eventType === 'contribution.simulated').length, 1);
  assert.equal(supporterEvents.find((event) => event.eventType === 'contribution.simulated').campaignTitle, completeDraft.title);
  assert.equal((await request('/api/activity', { token: 'creator_token' })).data.events.some((event) => event.eventType === 'campaign.approved' && event.campaignId === id), true);
  const report = await request('/api/reports', { token: 'supporter_token' });
  assert.equal(report.data.verifiedPayments.amountMinor, 0);
  assert.equal(report.data.simulatedContributions.amountMinor, 1000);
  assert.equal((await request(`/api/reports/campaigns/${id}`, { token: 'supporter_token' })).status, 404);
  const campaignReport = (await request(`/api/reports/campaigns/${id}`, { token: 'creator_token' })).data;
  assert.equal(campaignReport.fundingGoalMinor, 10000);
  assert.equal(campaignReport.simulatedRaisedMinor, 1000);
  assert.equal(campaignReport.remainingMinor, 9000);
  assert.equal(campaignReport.fundingPercentage, 10);
  assert.equal(campaignReport.verifiedRaisedMinor, 0);
  assert.equal(campaignReport.contributionType, 'simulated_only');
  const zeroGoal = await request('/api/campaigns', { token: 'creator_token', method: 'POST', body: { ...completeDraft, fundingGoal: '', instagramBudget: '' } });
  const zeroGoalReport = (await request(`/api/reports/campaigns/${zeroGoal.data.campaign.id}`, { token: 'creator_token' })).data;
  assert.equal(zeroGoalReport.fundingGoalMinor, 0);
  assert.equal(zeroGoalReport.fundingPercentage, 0);
  assert.equal(zeroGoalReport.remainingMinor, 0);
});

test('JSON store persists across store instances', async (t) => {
  const directory = await fs.mkdtemp(path.join(process.cwd(), '.test-data-signal-api-'));
  const filePath = path.join(directory, 'store.json');
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const firstStore = new JsonStore(filePath);
  await firstStore.update((state) => { state.campaigns.push({ id: 'persisted', ownerId: 'user-1', status: 'draft', data: {}, createdAt: '', updatedAt: '' }); });
  const secondStore = new JsonStore(filePath);
  assert.equal((await secondStore.read()).campaigns[0].id, 'persisted');
});
