const { randomUUID } = require('node:crypto');
const express = require('express');
const { createAuthMiddleware, validateCredentials } = require('./auth');

const CATEGORIES = new Set(['Environment', 'Education', 'Community', 'Human Rights']);
const CHANNELS = new Set(['instagram', 'facebook']);
const REVIEW_STATUSES = new Set(['under_review', 'approved', 'rejected']);
const MAX_JSON_BYTES = '1mb';

function apiError(status, code, message) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function str(value, max, field, required = false) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string') throw apiError(400, 'VALIDATION_ERROR', `${field} must be text.`);
  if (required && !value.trim()) throw apiError(400, 'VALIDATION_ERROR', `${field} is required.`);
  if (value.length > max) throw apiError(400, 'VALIDATION_ERROR', `${field} must be at most ${max} characters.`);
  return value;
}

function moneyToMinor(value, field) {
  if (value === '' || value === undefined || value === null) return 0;
  if (typeof value !== 'string' && typeof value !== 'number') throw apiError(400, 'VALIDATION_ERROR', `${field} must be a USD amount.`);
  const text = String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(text)) throw apiError(400, 'VALIDATION_ERROR', `${field} must be a non-negative USD amount with up to two decimal places.`);
  const minor = Math.round(Number(text) * 100);
  if (!Number.isSafeInteger(minor) || minor < 0) throw apiError(400, 'VALIDATION_ERROR', `${field} exceeds the supported amount.`);
  return minor;
}

function validateCampaignInput(value, { submitting = false } = {}) {
  if (!isPlainObject(value)) throw apiError(400, 'VALIDATION_ERROR', 'Campaign data must be an object.');
  const title = str(value.title, 60, 'Title', submitting);
  const category = value.category ?? '';
  if (category !== '' && !CATEGORIES.has(category)) throw apiError(400, 'VALIDATION_ERROR', 'Choose a supported campaign category.');
  const creatorName = str(value.creatorName, 120, 'Creator name', submitting);
  const summary = str(value.summary, 1000, 'Summary');
  const storyHeadline = str(value.storyHeadline, 180, 'Story headline', submitting);
  const introduction = str(value.introduction, 6000, 'Story introduction', submitting);
  const sections = value.sections ?? [];
  if (!Array.isArray(sections) || sections.length > 50) throw apiError(400, 'VALIDATION_ERROR', 'Story sections must be an array with at most 50 items.');
  const normalizedSections = sections.map((section, index) => {
    if (!isPlainObject(section)) throw apiError(400, 'VALIDATION_ERROR', `Story section ${index + 1} is invalid.`);
    return {
      id: str(section.id, 80, 'Story section ID') || randomUUID(),
      heading: str(section.heading, 180, 'Story section heading'),
      body: str(section.body, 12000, 'Story section body', submitting),
    };
  });
  const sources = value.sources ?? [];
  if (!Array.isArray(sources) || sources.length > 40) throw apiError(400, 'VALIDATION_ERROR', 'Sources must be an array with at most 40 items.');
  const normalizedSources = sources.map((source, index) => {
    if (!isPlainObject(source)) throw apiError(400, 'VALIDATION_ERROR', `Source ${index + 1} is invalid.`);
    const titleValue = str(source.title, 240, 'Source title', submitting);
    const url = str(source.url, 2048, 'Source URL', submitting);
    if (url) {
      let parsed;
      try { parsed = new URL(url); } catch { throw apiError(400, 'VALIDATION_ERROR', `Source ${index + 1} URL must be a valid HTTP or HTTPS URL.`); }
      if (!['http:', 'https:'].includes(parsed.protocol)) throw apiError(400, 'VALIDATION_ERROR', `Source ${index + 1} URL must use HTTP or HTTPS.`);
    }
    return { id: str(source.id, 80, 'Source ID') || randomUUID(), title: titleValue, url };
  });
  const locations = value.locations ?? [];
  if (!Array.isArray(locations) || locations.length > 100 || locations.some((item) => typeof item !== 'string' || item.length > 120)) {
    throw apiError(400, 'VALIDATION_ERROR', 'Target locations must be an array of at most 100 text values.');
  }
  const channels = value.channels ?? [];
  if (!Array.isArray(channels) || channels.some((channel) => !CHANNELS.has(channel)) || new Set(channels).size !== channels.length) {
    throw apiError(400, 'VALIDATION_ERROR', 'Distribution channels must be unique Instagram and/or Facebook values.');
  }
  const minimumAge = value.minimumAge ? Number(value.minimumAge) : null;
  const maximumAge = value.maximumAge ? Number(value.maximumAge) : null;
  for (const [label, age] of [['Minimum age', minimumAge], ['Maximum age', maximumAge]]) {
    if (age !== null && (!Number.isInteger(age) || age < 18 || age > 100)) throw apiError(400, 'VALIDATION_ERROR', `${label} must be an integer from 18 to 100.`);
  }
  if (minimumAge !== null && maximumAge !== null && maximumAge < minimumAge) throw apiError(400, 'VALIDATION_ERROR', 'Maximum age must be at least the minimum age.');
  const durationDays = value.durationDays === '' || value.durationDays === undefined ? null : Number(value.durationDays);
  if (durationDays !== null && (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 90)) throw apiError(400, 'VALIDATION_ERROR', 'Campaign duration must be from 1 to 90 days.');
  const fundingGoalMinor = moneyToMinor(value.fundingGoal, 'Funding goal');
  const instagramBudgetMinor = moneyToMinor(value.instagramBudget, 'Instagram allocation');
  const facebookBudgetMinor = moneyToMinor(value.facebookBudget, 'Facebook allocation');
  if (fundingGoalMinor > 0 && instagramBudgetMinor + facebookBudgetMinor > fundingGoalMinor) throw apiError(400, 'VALIDATION_ERROR', 'Channel allocations cannot exceed the campaign funding goal.');
  if (submitting) {
    if (!CATEGORIES.has(category)) throw apiError(400, 'VALIDATION_ERROR', 'Choose a supported campaign category.');
    if (!normalizedSections.length || !normalizedSections.some((section) => section.body.trim())) throw apiError(400, 'VALIDATION_ERROR', 'Add at least one non-empty story section.');
    if (!locations.length || !channels.length || durationDays === null) throw apiError(400, 'VALIDATION_ERROR', 'Choose target locations, distribution channels, and a campaign duration.');
    if (fundingGoalMinor <= 0 || instagramBudgetMinor + facebookBudgetMinor <= 0) throw apiError(400, 'VALIDATION_ERROR', 'Set a positive funding goal and channel allocation.');
    if (channels.includes('instagram') !== (instagramBudgetMinor > 0) && instagramBudgetMinor > 0) throw apiError(400, 'VALIDATION_ERROR', 'Select Instagram when allocating its budget.');
    if (channels.includes('facebook') !== (facebookBudgetMinor > 0) && facebookBudgetMinor > 0) throw apiError(400, 'VALIDATION_ERROR', 'Select Facebook when allocating its budget.');
    if (value.policyAccepted !== true) throw apiError(400, 'VALIDATION_ERROR', 'Confirm the submission rules before submitting.');
  }
  return {
    title,
    category,
    creatorName,
    summary,
    coverUri: str(value.coverUri, 2048, 'Cover image reference'),
    coverAlt: str(value.coverAlt, 500, 'Cover image description'),
    storyHeadline,
    introduction,
    sections: normalizedSections,
    sources: normalizedSources,
    audienceActions: str(value.audienceActions, 2000, 'Audience actions'),
    adHeadline: str(value.adHeadline, 180, 'Ad headline'),
    adDescription: str(value.adDescription, 2000, 'Ad description'),
    callToAction: str(value.callToAction, 80, 'Call to action'),
    adImageUri: str(value.adImageUri, 2048, 'Ad image reference'),
    adImageAlt: str(value.adImageAlt, 500, 'Ad image description'),
    adImageMetadata: str(value.adImageMetadata, 2000, 'Ad image metadata'),
    locations: locations.map((location) => location.trim()).filter(Boolean),
    minimumAge,
    maximumAge,
    interests: str(value.interests, 1000, 'Audience interests'),
    channels,
    durationDays,
    instagramBudgetMinor,
    facebookBudgetMinor,
    fundingGoalMinor,
    currency: 'USD',
    policyAccepted: value.policyAccepted === true,
  };
}

function validateIdempotency(value) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 120 || !/^[A-Za-z0-9._:-]+$/.test(value)) {
    throw apiError(400, 'VALIDATION_ERROR', 'Provide a valid idempotency key.');
  }
  return value;
}

function validateDemoContribution(body) {
  if (!isPlainObject(body)) throw apiError(400, 'VALIDATION_ERROR', 'Contribution data must be an object.');
  if (!Number.isSafeInteger(body.amountMinor) || body.amountMinor < 100 || body.amountMinor > 100000) {
    throw apiError(400, 'VALIDATION_ERROR', 'Demo contributions must be between 100 and 100000 USD cents.');
  }
  if (body.currency !== 'USD') throw apiError(400, 'VALIDATION_ERROR', 'This demo supports USD only.');
  return { amountMinor: body.amountMinor, currency: 'USD', idempotencyKey: validateIdempotency(body.idempotencyKey) };
}

function validateStoredCampaignForSubmission(data, policyAccepted) {
  if (!data.title.trim() || !CATEGORIES.has(data.category) || !data.creatorName.trim()) throw apiError(400, 'VALIDATION_ERROR', 'Title, category, and creator name are required.');
  if (!data.storyHeadline.trim() || !data.introduction.trim() || !data.sections.some((section) => section.body.trim())) throw apiError(400, 'VALIDATION_ERROR', 'Add a story headline, introduction, and at least one story section.');
  if (!data.locations.length || !data.channels.length || !Number.isInteger(data.durationDays) || data.durationDays < 1 || data.durationDays > 90) throw apiError(400, 'VALIDATION_ERROR', 'Choose target locations, distribution channels, and a campaign duration from 1 to 90 days.');
  if (data.fundingGoalMinor <= 0 || data.instagramBudgetMinor + data.facebookBudgetMinor <= 0) throw apiError(400, 'VALIDATION_ERROR', 'Set a positive funding goal and channel allocation.');
  if (data.instagramBudgetMinor > 0 && !data.channels.includes('instagram') || data.facebookBudgetMinor > 0 && !data.channels.includes('facebook')) throw apiError(400, 'VALIDATION_ERROR', 'Select every channel that has a budget allocation.');
  if (data.instagramBudgetMinor + data.facebookBudgetMinor > data.fundingGoalMinor) throw apiError(400, 'VALIDATION_ERROR', 'Channel allocations cannot exceed the campaign funding goal.');
  if (policyAccepted !== true) throw apiError(400, 'VALIDATION_ERROR', 'Confirm the submission rules before submitting.');
}

function addActivity(state, userId, campaignId, eventType, metadata = {}) {
  state.activity.unshift({ id: randomUUID(), userId, campaignId, eventType, metadata, createdAt: new Date().toISOString() });
  state.activity = state.activity.slice(0, 5000);
}

function visibleTo(user, campaign) {
  return campaign.ownerId === user.id || campaign.status === 'approved';
}

function createApp({ store, campaigns, auth, authMiddleware, authService } = {}) {
  if (!store && !campaigns) throw new Error('A campaign persistence adapter is required.');
  const app = express();
  const authenticate = authMiddleware || createAuthMiddleware(auth || {
    verifyAccessToken: async () => { throw new Error('Auth unavailable'); },
  });
  const authApi = authService || auth;

  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const allowedOrigin = process.env.SIGNAL_CORS_ORIGIN || '*';
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Expose-Headers', 'Retry-After');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  });
  app.use(express.json({ limit: MAX_JSON_BYTES, strict: true }));
  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'signal-api', persistence: campaigns ? 'supabase' : 'backend-file' }));

  app.post('/api/auth/signup', async (req, res) => {
    const invalid = validateCredentials(req.body, true);
    if (invalid) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: invalid } });
    if (!authApi?.signUp) return res.status(503).json({ error: { code: 'AUTH_UNAVAILABLE', message: 'Supabase Auth is not configured.' } });
    const result = await authApi.signUp(req.body.name.trim(), req.body.email.trim().toLowerCase(), req.body.password);
    return res.status(201).json(result);
  });
  app.post('/api/auth/login', async (req, res) => {
    const invalid = validateCredentials(req.body);
    if (invalid) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: invalid } });
    if (!authApi?.signIn) return res.status(503).json({ error: { code: 'AUTH_UNAVAILABLE', message: 'Supabase Auth is not configured.' } });
    return res.json(await authApi.signIn(req.body.email.trim().toLowerCase(), req.body.password));
  });
  app.get('/api/auth/me', authenticate, (req, res) => res.json({ user: req.auth }));

  app.get('/api/campaigns', authenticate, async (req, res) => {
    if (campaigns) return res.json({ campaigns: await campaigns.listCampaigns(req.supabaseAccessToken, req.auth.id, req.query.mine === 'true') });
    const state = await store.read();
    const campaigns = state.campaigns.filter((campaign) => req.query.mine === 'true'
      ? campaign.ownerId === req.auth.id
      : visibleTo(req.auth, campaign));
    return res.json({ campaigns });
  });
  app.post('/api/campaigns', authenticate, async (req, res) => {
    const data = validateCampaignInput(req.body);
    if (campaigns) {
      const campaign = await campaigns.saveDraft(randomUUID(), req.auth.id, data, req.supabaseAccessToken);
      return res.status(201).json({ campaign });
    }
    const campaign = await store.update((state) => {
      const now = new Date().toISOString();
      const created = { id: randomUUID(), ownerId: req.auth.id, status: 'draft', data, createdAt: now, updatedAt: now, submittedAt: null, review: null };
      state.campaigns.unshift(created);
      addActivity(state, req.auth.id, created.id, 'campaign.draft_created');
      return created;
    });
    return res.status(201).json({ campaign });
  });
  app.get('/api/campaigns/:id/contributions', authenticate, async (req, res) => {
    const state = await store.read();
    const campaign = campaigns
      ? await campaigns.getCampaign(req.params.id, req.supabaseAccessToken)
      : state.campaigns.find((item) => item.id === req.params.id);
    if (!campaign || !visibleTo(req.auth, campaign)) throw apiError(404, 'NOT_FOUND', 'Campaign was not found.');
    const records = campaigns
      ? await campaigns.listDemoContributions(campaign.id, null, req.supabaseAccessToken)
      : state.demoContributions.filter((item) => item.campaignId === campaign.id);
    const simulatedRaisedMinor = records.reduce((total, item) => Math.min(Number.MAX_SAFE_INTEGER, total + item.amountMinor), 0);
    return res.json({
      campaignId: campaign.id,
      currency: campaign.data.currency,
      fundingGoalMinor: campaign.data.fundingGoalMinor,
      simulatedRaisedMinor,
      remainingMinor: Math.max(0, campaign.data.fundingGoalMinor - simulatedRaisedMinor),
      fundingPercentage: campaign.data.fundingGoalMinor > 0
        ? (simulatedRaisedMinor / campaign.data.fundingGoalMinor) * 100
        : 0,
      simulatedContributionCount: records.length,
      verifiedRaisedMinor: 0,
      contributionType: 'simulated_only',
      actualPaymentsEnabled: false,
      records,
    });
  });
  app.get('/api/campaigns/:id', authenticate, async (req, res) => {
    if (campaigns) {
      const campaign = await campaigns.getCampaign(req.params.id, req.supabaseAccessToken);
      if (!campaign) throw apiError(404, 'NOT_FOUND', 'Campaign was not found.');
      return res.json({ campaign });
    }
    const state = await store.read();
    const campaign = state.campaigns.find((item) => item.id === req.params.id);
    if (!campaign || !visibleTo(req.auth, campaign)) throw apiError(404, 'NOT_FOUND', 'Campaign was not found.');
    return res.json({ campaign });
  });
  app.patch('/api/campaigns/:id', authenticate, async (req, res) => {
    const data = validateCampaignInput(req.body);
    if (campaigns) {
      const current = await campaigns.getCampaign(req.params.id, req.supabaseAccessToken);
      if (!current || current.ownerId !== req.auth.id) throw apiError(404, 'NOT_FOUND', 'Campaign was not found.');
      if (current.status !== 'draft') throw apiError(409, 'CAMPAIGN_LOCKED', 'Only draft campaigns can be edited.');
      return res.json({ campaign: await campaigns.saveDraft(req.params.id, req.auth.id, data, req.supabaseAccessToken) });
    }
    const campaign = await store.update((state) => {
      const item = state.campaigns.find((candidate) => candidate.id === req.params.id);
      if (!item || item.ownerId !== req.auth.id) throw apiError(404, 'NOT_FOUND', 'Campaign was not found.');
      if (item.status !== 'draft') throw apiError(409, 'CAMPAIGN_LOCKED', 'Only draft campaigns can be edited.');
      item.data = data;
      item.updatedAt = new Date().toISOString();
      return item;
    });
    return res.json({ campaign });
  });
  app.delete('/api/campaigns/:id', authenticate, async (req, res) => {
    if (campaigns) {
      const current = await campaigns.getCampaign(req.params.id, req.supabaseAccessToken);
      if (!current || current.ownerId !== req.auth.id) throw apiError(404, 'NOT_FOUND', 'Campaign was not found.');
      if (current.status !== 'draft') throw apiError(409, 'CAMPAIGN_LOCKED', 'Only draft campaigns can be deleted.');
      await campaigns.deleteDraft(req.params.id, req.supabaseAccessToken);
      return res.sendStatus(204);
    }
    await store.update((state) => {
      const index = state.campaigns.findIndex((item) => item.id === req.params.id && item.ownerId === req.auth.id);
      if (index < 0) throw apiError(404, 'NOT_FOUND', 'Campaign was not found.');
      if (state.campaigns[index].status !== 'draft') throw apiError(409, 'CAMPAIGN_LOCKED', 'Only draft campaigns can be deleted.');
      state.campaigns.splice(index, 1);
    });
    return res.sendStatus(204);
  });

  app.get('/api/drafts', authenticate, async (req, res) => {
    if (campaigns) return res.json({ drafts: (await campaigns.listCampaigns(req.supabaseAccessToken, req.auth.id, true)).filter((item) => item.status === 'draft') });
    const state = await store.read();
    return res.json({ drafts: state.campaigns.filter((item) => item.ownerId === req.auth.id && item.status === 'draft') });
  });
  app.post('/api/drafts', authenticate, async (req, res) => {
    const data = validateCampaignInput(req.body);
    if (campaigns) {
      const draft = await campaigns.saveDraft(randomUUID(), req.auth.id, data, req.supabaseAccessToken);
      return res.status(201).json({ draft });
    }
    const draft = await store.update((state) => {
      const now = new Date().toISOString();
      const item = { id: randomUUID(), ownerId: req.auth.id, status: 'draft', data, createdAt: now, updatedAt: now, submittedAt: null, review: null };
      state.campaigns.unshift(item);
      addActivity(state, req.auth.id, item.id, 'campaign.draft_created');
      return item;
    });
    return res.status(201).json({ draft });
  });
  app.put('/api/drafts/:id', authenticate, async (req, res) => {
    if (!/^[A-Za-z0-9._:-]{1,100}$/.test(req.params.id)) throw apiError(400, 'VALIDATION_ERROR', 'Draft ID is invalid.');
    const data = validateCampaignInput(req.body);
    if (campaigns) return res.json({ draft: await campaigns.saveDraft(req.params.id, req.auth.id, data, req.supabaseAccessToken) });
    const draft = await store.update((state) => {
      let item = state.campaigns.find((candidate) => candidate.id === req.params.id);
      if (item && item.ownerId !== req.auth.id) throw apiError(404, 'NOT_FOUND', 'Draft was not found.');
      if (item && item.status !== 'draft') throw apiError(409, 'CAMPAIGN_LOCKED', 'Only draft campaigns can be edited.');
      const now = new Date().toISOString();
      if (item) {
        item.data = data;
        item.updatedAt = now;
      } else {
        item = { id: req.params.id, ownerId: req.auth.id, status: 'draft', data, createdAt: now, updatedAt: now, submittedAt: null, review: null };
        state.campaigns.unshift(item);
        addActivity(state, req.auth.id, item.id, 'campaign.draft_created');
      }
      return item;
    });
    return res.json({ draft });
  });
  app.get('/api/drafts/:id', authenticate, async (req, res) => {
    if (campaigns) {
      const draft = await campaigns.getCampaign(req.params.id, req.supabaseAccessToken);
      if (!draft || draft.ownerId !== req.auth.id || draft.status !== 'draft') throw apiError(404, 'NOT_FOUND', 'Draft was not found.');
      return res.json({ draft });
    }
    const state = await store.read();
    const draft = state.campaigns.find((item) => item.id === req.params.id && item.ownerId === req.auth.id && item.status === 'draft');
    if (!draft) throw apiError(404, 'NOT_FOUND', 'Draft was not found.');
    return res.json({ draft });
  });
  app.patch('/api/drafts/:id', authenticate, async (req, res) => {
    const data = validateCampaignInput(req.body);
    if (campaigns) return res.json({ draft: await campaigns.saveDraft(req.params.id, req.auth.id, data, req.supabaseAccessToken) });
    const draft = await store.update((state) => {
      const item = state.campaigns.find((candidate) => candidate.id === req.params.id && candidate.ownerId === req.auth.id);
      if (!item) throw apiError(404, 'NOT_FOUND', 'Draft was not found.');
      if (item.status !== 'draft') throw apiError(409, 'CAMPAIGN_LOCKED', 'Only draft campaigns can be edited.');
      item.data = data;
      item.updatedAt = new Date().toISOString();
      return item;
    });
    return res.json({ draft });
  });
  app.post('/api/campaigns/:id/submit', authenticate, async (req, res) => {
    if (campaigns) {
      const current = await campaigns.getCampaign(req.params.id, req.supabaseAccessToken);
      if (!current || current.ownerId !== req.auth.id) throw apiError(404, 'NOT_FOUND', 'Campaign was not found.');
      if (current.status !== 'draft') return res.json({ campaign: current, message: 'Campaign submission was already confirmed.' });
      validateStoredCampaignForSubmission(current.data, req.body?.policyAccepted === true);
      const campaign = await campaigns.submitCampaign(req.params.id, req.body?.policyAccepted === true, req.supabaseAccessToken);
      if (!campaign || !['submitted', 'under_review', 'approved', 'rejected', 'completed'].includes(campaign.status)) {
        throw apiError(502, 'SUBMISSION_UNCONFIRMED', 'Supabase did not confirm that the campaign was submitted.');
      }
      return res.json({ campaign, message: 'Campaign was saved to Supabase and submitted to the SIGNAL API review queue.' });
    }
    const campaign = await store.update((state) => {
      const item = state.campaigns.find((candidate) => candidate.id === req.params.id && candidate.ownerId === req.auth.id);
      if (!item) throw apiError(404, 'NOT_FOUND', 'Campaign was not found.');
      if (item.status !== 'draft') throw apiError(409, 'CAMPAIGN_LOCKED', 'Only a draft campaign can be submitted.');
      validateStoredCampaignForSubmission(item.data, req.body?.policyAccepted === true);
      const now = new Date().toISOString();
      item.status = 'submitted';
      item.submittedAt = now;
      item.updatedAt = now;
      item.review = { status: 'submitted', reviewerId: null, feedback: '', reviewedAt: null };
      state.statusHistory = state.statusHistory || [];
      state.statusHistory.unshift({ id: randomUUID(), campaignId: item.id, actorId: req.auth.id, fromStatus: 'draft', toStatus: 'submitted', note: '', createdAt: now });
      addActivity(state, req.auth.id, item.id, 'campaign.submitted');
      return item;
    });
    return res.json({ campaign, message: 'Campaign was submitted to the SIGNAL API review queue.' });
  });

  app.post('/api/reviews/:campaignId/status', authenticate, async (req, res) => {
    if (!['reviewer', 'admin'].includes(req.auth.role)) throw apiError(403, 'FORBIDDEN', 'A reviewer or admin role is required.');
    if (!isPlainObject(req.body) || !REVIEW_STATUSES.has(req.body.status)) throw apiError(400, 'VALIDATION_ERROR', 'Review status must be under_review, approved, or rejected.');
    const feedback = str(req.body.feedback ?? '', 2000, 'Review feedback');
    if (campaigns) {
      const campaign = await campaigns.getCampaign(req.params.campaignId, req.supabaseAccessToken);
      if (!campaign) throw apiError(404, 'NOT_FOUND', 'Campaign was not found.');
      return res.json({ campaign: await campaigns.reviewCampaign(req.params.campaignId, req.body.status, feedback, req.supabaseAccessToken) });
    }
    const campaign = await store.update((state) => {
      const item = state.campaigns.find((candidate) => candidate.id === req.params.campaignId);
      if (!item) throw apiError(404, 'NOT_FOUND', 'Campaign was not found.');
      if (!['submitted', 'under_review'].includes(item.status)) throw apiError(409, 'INVALID_TRANSITION', 'Only submitted campaigns can enter or complete review.');
      const previous = item.status;
      const now = new Date().toISOString();
      item.status = req.body.status;
      item.review = { status: req.body.status, reviewerId: req.auth.id, feedback, reviewedAt: now };
      item.updatedAt = now;
      state.statusHistory = state.statusHistory || [];
      state.statusHistory.unshift({ id: randomUUID(), campaignId: item.id, actorId: req.auth.id, fromStatus: previous, toStatus: item.status, note: feedback, createdAt: now });
      addActivity(state, item.ownerId, item.id, `campaign.${item.status}`, { reviewerId: req.auth.id });
      return item;
    });
    return res.json({ campaign });
  });

  app.post('/api/contributions', authenticate, (_req, res) => res.status(501).json({
    error: { code: 'PAYMENTS_NOT_CONFIGURED', message: 'Real payments are not configured. No payment was attempted.' },
  }));
  app.post('/api/demo/contributions', authenticate, async (req, res) => {
    const input = validateDemoContribution(req.body);
    if (campaigns) {
      const contribution = await campaigns.createDemoContribution(req.body.campaignId, input.amountMinor, input.idempotencyKey, req.supabaseAccessToken);
      return res.status(201).json({ contribution, simulated: true, actualPaymentProcessed: false });
    }
    const campaign = await store.update((state) => {
      const item = state.campaigns.find((candidate) => candidate.id === req.body.campaignId);
      if (!item || item.status !== 'approved') throw apiError(404, 'CAMPAIGN_UNAVAILABLE', 'Only approved campaigns can accept demo contributions.');
      if (item.ownerId === req.auth.id) throw apiError(403, 'SELF_CONTRIBUTION_BLOCKED', 'Creators cannot contribute to their own campaign.');
      let contribution = state.demoContributions.find((record) => record.contributorId === req.auth.id && record.campaignId === item.id && record.idempotencyKey === input.idempotencyKey);
      if (!contribution) {
        contribution = { id: randomUUID(), campaignId: item.id, contributorId: req.auth.id, amountMinor: input.amountMinor, currency: input.currency, status: 'simulated', idempotencyKey: input.idempotencyKey, createdAt: new Date().toISOString() };
        state.demoContributions.push(contribution);
        addActivity(state, req.auth.id, item.id, 'contribution.simulated', { contributionId: contribution.id, amountMinor: contribution.amountMinor, currency: contribution.currency });
        addActivity(state, item.ownerId, item.id, 'contribution.simulated', { contributionId: contribution.id, amountMinor: contribution.amountMinor, currency: contribution.currency });
      }
      return contribution;
    });
    return res.status(201).json({ contribution: campaign, simulated: true, actualPaymentProcessed: false });
  });

  app.get('/api/activity', authenticate, async (req, res) => {
    if (campaigns) return res.json({ events: await campaigns.listActivity(req.supabaseAccessToken) });
    const state = await store.read();
    const events = state.activity.filter((event) => event.userId === req.auth.id).slice(0, 200).map((event) => ({
      ...event,
      campaignTitle: state.campaigns.find((campaign) => campaign.id === event.campaignId)?.data?.title ?? null,
    }));
    return res.json({ events });
  });
  app.get('/api/reports', authenticate, async (req, res) => {
    const state = await store.read();
    const owned = campaigns
      ? await campaigns.listCampaigns(req.supabaseAccessToken, req.auth.id, true)
      : state.campaigns.filter((item) => item.ownerId === req.auth.id);
    const contributions = campaigns
      ? await campaigns.listDemoContributions(null, req.auth.id, req.supabaseAccessToken)
      : state.demoContributions.filter((item) => item.contributorId === req.auth.id);
    return res.json({
      persistence: campaigns ? 'supabase' : 'backend-file',
      campaignCounts: Object.fromEntries(['draft', 'submitted', 'under_review', 'approved', 'rejected'].map((status) => [status, owned.filter((item) => item.status === status).length])),
      simulatedContributions: { count: contributions.length, amountMinor: contributions.reduce((sum, item) => Math.min(Number.MAX_SAFE_INTEGER, sum + item.amountMinor), 0), currency: 'USD' },
      verifiedPayments: { count: 0, amountMinor: 0, currency: 'USD' },
      actualAdDelivery: { connected: false },
    });
  });
  app.get('/api/reports/campaigns/:id', authenticate, async (req, res) => {
    const state = await store.read();
    const campaign = campaigns
      ? await campaigns.getCampaign(req.params.id, req.supabaseAccessToken)
      : state.campaigns.find((item) => item.id === req.params.id);
    if (!campaign || (campaign.ownerId !== req.auth.id && !['reviewer', 'admin'].includes(req.auth.role))) throw apiError(404, 'NOT_FOUND', 'Campaign was not found.');
    const records = campaigns
      ? await campaigns.listDemoContributions(campaign.id, null, req.supabaseAccessToken)
      : state.demoContributions.filter((item) => item.campaignId === campaign.id);
    const simulatedRaisedMinor = records.reduce((sum, item) => Math.min(Number.MAX_SAFE_INTEGER, sum + item.amountMinor), 0);
    const fundingGoalMinor = campaign.data.fundingGoalMinor;
    return res.json({
      campaignId: campaign.id,
      status: campaign.status,
      fundingGoalMinor,
      simulatedContributionCount: records.length,
      simulatedRaisedMinor,
      remainingMinor: Math.max(0, fundingGoalMinor - simulatedRaisedMinor),
      fundingPercentage: fundingGoalMinor > 0 ? (simulatedRaisedMinor / fundingGoalMinor) * 100 : 0,
      verifiedRaisedMinor: 0,
      contributionType: 'simulated_only',
      currency: campaign.data.currency,
      contributionRecords: records,
      activity: campaigns
        ? (await campaigns.listActivity(req.supabaseAccessToken)).filter((event) => event.campaignId === campaign.id)
        : state.activity.filter((event) => event.campaignId === campaign.id),
      estimatedReach: { available: false, label: 'No verified delivery data' },
    });
  });

  app.use((error, _req, res, _next) => {
    const status = Number.isInteger(error.status) ? error.status : 500;
    const code = typeof error.code === 'string' ? error.code : status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR';
    const message = status === 500 ? 'The request could not be completed.' : error.message;
    if (typeof error.retryAfter === 'string' && error.retryAfter) res.set('Retry-After', error.retryAfter);
    return res.status(status).json({ error: { code, message } });
  });
  return app;
}

module.exports = { createApp, validateCampaignInput, validateDemoContribution, apiError };
