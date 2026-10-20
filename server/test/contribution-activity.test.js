const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { filterActivityEvents, filterActivityNotifications } = require('../../src/data/local-activity-core');

function loadTypeScriptModule(relativePath, imports = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../../src', relativePath), 'utf8');
  const module = { exports: {} };
  const testRequire = (name) => Object.hasOwn(imports, name) ? imports[name] : require(name);
  new Function('exports', 'require', 'module', ts.transpile(source, { module: ts.ModuleKind.CommonJS }))(
    module.exports,
    testRequire,
    module,
  );
  return module.exports;
}

function createProcessingHarness({ failActivityWrites = 0 } = {}) {
  const storedDrafts = new Map();
  const contributionsByKey = new Map();
  const activityWrites = [];
  let commitCount = 0;
  let remainingActivityFailures = failActivityWrites;

  const draftStorage = {
    async readCampaignDraft(key) { return storedDrafts.get(key) ?? null; },
    async writeCampaignDraft(key, value) { storedDrafts.set(key, value); },
  };
  const contributionFlow = loadTypeScriptModule('data/contribution-flow.ts', {
    '@/data/campaign-draft-storage': draftStorage,
    '@/data/demo-reach': { DEMO_REACH_PER_RUPEE: 1, DEMO_REACH_PER_DOLLAR: 1, demoUsdToInrMinor: (value) => value },
    '@/types/local-campaign': {},
  });
  const demoContributions = {
    async addDemoContribution(_supporterId, campaignId, amountMinor, idempotencyKey) {
      commitCount += 1;
      if (contributionsByKey.has(idempotencyKey)) return contributionsByKey.get(idempotencyKey);
      const contribution = {
        id: `contribution-${idempotencyKey}`,
        campaignId,
        amountMinor,
        currency: 'USD',
        status: 'simulated',
        createdAt: '2026-10-20T12:00:00.000Z',
        idempotencyKey,
      };
      contributionsByKey.set(idempotencyKey, contribution);
      return contribution;
    },
    async readCampaignDemoContributions(campaignId) {
      return [...contributionsByKey.values()].filter((item) => item.campaignId === campaignId);
    },
  };
  const localActivity = {
    async recordLocalContribution(ownerId, contribution, campaignTitle) {
      activityWrites.push({ ownerId, contributionId: contribution.id, campaignTitle });
      if (remainingActivityFailures > 0) {
        remainingActivityFailures -= 1;
        throw new Error('Activity storage is temporarily unavailable.');
      }
    },
  };
  const processing = loadTypeScriptModule('data/contribution-processing.ts', {
    '@/data/demo-contributions': demoContributions,
    '@/data/contribution-flow': contributionFlow,
    '@/data/signal-api': {
      async createDemoContributionFromApi() { throw new Error('Unexpected API contribution path in catalog test.'); },
      async listDemoContributionsFromApi() { return []; },
    },
    '@/data/local-activity': localActivity,
    '@/types/local-campaign': {},
  });

  return { processing, contributionFlow, activityWrites, getCommitCount: () => commitCount };
}

function createFlow(id) {
  const now = '2026-10-20T12:00:00.000Z';
  return {
    id,
    campaignRouteId: 'our-lakes-arent-dumping-grounds',
    campaignId: 'green-bengaluru-lakes',
    campaignTitle: "Our Lakes Aren't Dumping Grounds",
    origin: 'catalog',
    amountMinor: 1000,
    currency: 'USD',
    feeMinor: 0,
    totalMinor: 1000,
    campaignAmountMinor: 1000,
    campaignCurrency: 'INR',
    estimatedPotentialReach: 100,
    showFirstName: false,
    status: 'checkout',
    outcome: 'success',
    createdAt: now,
    updatedAt: now,
  };
}

test('persisted contribution events appear under Contributions while All and Account remain intact', async () => {
  const storedDrafts = new Map();
  const activityStorage = {
    async readCampaignDraft(key) { return storedDrafts.get(key) ?? null; },
    async writeCampaignDraft(key, value) { storedDrafts.set(key, value); },
    async readCampaignSubmission() { return null; },
    async readCampaignSubmissions() { return []; },
  };
  const localActivity = loadTypeScriptModule('data/local-activity.ts', {
    '@/data/campaign-draft-storage': activityStorage,
    '@/data/campaigns': { discoveryCampaigns: [{ id: 'green-bengaluru-lakes', title: "Our Lakes Aren't Dumping Grounds" }] },
    '@/data/local-activity-core': require('../../src/data/local-activity-core'),
    '@/types/local-campaign': { normalizeLocalCampaignDraft: () => null },
  });
  await localActivity.recordLocalContribution('persisted-user-1', {
    id: 'contribution-1',
    campaignId: 'green-bengaluru-lakes',
    amountMinor: 1000,
    currency: 'USD',
    createdAt: '2026-10-20T12:00:00.000Z',
    idempotencyKey: 'contribution-flow-1',
  }, "Our Lakes Aren't Dumping Grounds");
  const persistedContribution = (await localActivity.readLocalActivityEvents('persisted-user-1'))[0];
  const campaignSubmission = {
    id: 'submission-1',
    eventType: 'campaign.submitted',
    kind: 'account-status',
  };
  assert.equal(persistedContribution.eventType, 'contribution.simulated');

  assert.deepEqual(filterActivityEvents([campaignSubmission, persistedContribution], 'Contributions'), [persistedContribution]);
  assert.deepEqual(filterActivityEvents([campaignSubmission, persistedContribution], 'Account'), [campaignSubmission, persistedContribution]);
  assert.deepEqual(filterActivityEvents([campaignSubmission, persistedContribution], 'All'), [campaignSubmission, persistedContribution]);
  assert.deepEqual(filterActivityNotifications([{ category: 'Contributions', id: 'sample-contribution' }], 'Contributions'), []);
  assert.equal(filterActivityNotifications([{ category: 'Contributions', id: 'sample-contribution' }], 'All').length, 1);
});

test('auth restoration defers owner resolution and processing route waits for the resolved owner', () => {
  const { resolveContributionActivityOwner } = loadTypeScriptModule('data/contribution-processing.ts', {
    '@/data/demo-contributions': {},
    '@/data/contribution-flow': {},
    '@/data/signal-api': {},
    '@/data/local-activity': {},
    '@/types/local-campaign': {},
  });
  assert.equal(resolveContributionActivityOwner(true, 'restored-user'), null);
  assert.equal(resolveContributionActivityOwner(false, 'restored-user'), 'restored-user');
  assert.equal(resolveContributionActivityOwner(false, undefined), 'device-draft');

  const route = fs.readFileSync(path.join(__dirname, '../../src/app/contribute/processing/[flowId].tsx'), 'utf8');
  assert.match(route, /resolveContributionActivityOwner\(authLoading, user\?\.id\)/);
  assert.match(route, /if \(activityOwnerId === null\) return;/);
});

test('signed-in and anonymous contributions keep their resolved Activity owners', async () => {
  const harness = createProcessingHarness();
  const signedInFlow = await harness.processing.processContributionFlow(createFlow('flow-signed-in-1'), undefined, 'user-verified-1');
  const anonymousFlow = await harness.processing.processContributionFlow(createFlow('flow-anonymous-1'), undefined, 'device-draft');

  assert.equal(signedInFlow.status, 'success');
  assert.equal(signedInFlow.activityOwnerId, 'user-verified-1');
  assert.equal(anonymousFlow.status, 'success');
  assert.equal(anonymousFlow.activityOwnerId, 'device-draft');
  assert.deepEqual(harness.activityWrites.map((write) => write.ownerId), ['user-verified-1', 'device-draft']);
});

test('failed Activity write is recoverable from the saved success without committing twice', async () => {
  const harness = createProcessingHarness({ failActivityWrites: 1 });
  const successful = await harness.processing.processContributionFlow(createFlow('flow-recovery-1'), undefined, 'user-verified-2');
  assert.equal(successful.status, 'success');
  assert.equal(successful.activityEventPending, true);
  assert.equal(harness.getCommitCount(), 1);

  const recovered = await harness.processing.retryContributionConfirmation('flow-recovery-1', undefined, 'different-current-user');
  assert.equal(recovered.status, 'success');
  assert.equal(recovered.activityEventPending, false);
  assert.equal(recovered.contribution.id, successful.contribution.id);
  assert.deepEqual(harness.activityWrites.map((write) => write.ownerId), ['user-verified-2', 'user-verified-2']);
  assert.equal(harness.getCommitCount(), 1);
});
