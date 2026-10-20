const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { mergeAccountEvents, recoverArchivedSubmissionEvents } = require('../../src/data/local-activity-core');

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

const localCampaignTypes = loadTypeScriptModule('types/local-campaign.ts');

// Stub discoveryCampaigns to avoid image require issues in test environment
const mockDiscoveryCampaigns = [
  { id: 'pages-for-all-library', title: 'Every Child Deserves a Library' },
  { id: 'green-bengaluru-lakes', title: "Our Lakes Aren't Dumping Grounds" },
  { id: 'neighbourhood-arts-collective', title: 'Let Our Neighbourhood Tell Its Story' },
  { id: 'better-streets-collective', title: 'The Streets We Deserve' },
  { id: 'community-health-connect', title: 'Health Information Should Reach Everyone' },
  { id: 'community-science-watch', title: 'Community Science, Shared Discoveries' },
  { id: 'people-first-city-budget', title: 'A Clearer View of the City Budget' },
  { id: 'neighbourhood-makers-market', title: 'A Market for Neighbourhood Makers' },
  { id: 'neighbourhood-heat-safety', title: 'Cooler Routes Through Our Neighbourhood' },
  { id: 'stories-across-generations', title: 'Stories That Bring Generations Together' },
  { id: 'ananya-lake-shared-responsibility', title: 'Our Lakes, Our Shared Responsibility' },
  { id: 'rohan-safer-streets-everyone', title: 'Safer Streets Begin With Everyone' },
  { id: 'amara-clean-water-community', title: 'Clean Water, Stronger Communities' },
  { id: 'lucas-room-to-move', title: 'Room to Move: Streets for Everyone' },
  { id: 'yuki-art-in-every-neighbourhood', title: 'Art Belongs in Every Neighbourhood' },
];

const campaignsModule = { discoveryCampaigns: mockDiscoveryCampaigns };

const webStorageCore = loadTypeScriptModule('data/campaign-draft-storage-web-core.ts');
const webStorage = loadTypeScriptModule('data/campaign-draft-storage.web.ts', {
  '@/data/campaign-draft-storage-web-core': webStorageCore,
  '@/types/local-campaign': localCampaignTypes,
});

test('recovers one local activity event from an archived submission created before Activity tracking', () => {
  const submittedAt = '2026-10-18T10:15:00.000Z';
  const submission = { id: 'campaign-existing', title: 'Saved campaign', submittedAt };
  const archivedCampaign = {
    id: submission.id,
    title: submission.title,
    localStatus: 'submitted_locally',
  };

  const firstRead = recoverArchivedSubmissionEvents([], [submission], { [submission.id]: archivedCampaign }, 'fallback-time');
  const repeatedRead = recoverArchivedSubmissionEvents(firstRead, [submission], { [submission.id]: archivedCampaign }, 'later-time');

  assert.equal(firstRead.length, 1);
  assert.equal(firstRead[0].eventType, 'campaign.submitted');
  assert.equal(firstRead[0].campaignId, submission.id);
  assert.equal(firstRead[0].campaignTitle, submission.title);
  assert.equal(firstRead[0].createdAt, submittedAt);
  assert.equal(firstRead[0].metadata.recoveredFromSavedSubmission, true);
  assert.equal(repeatedRead.length, 1);
  assert.equal(repeatedRead[0].createdAt, submittedAt);
});

test('does not create activity for a draft or an archived campaign that cannot be read', () => {
  const submissions = [
    { id: 'draft-1', title: 'Still a draft', submittedAt: '2026-10-18T10:15:00.000Z' },
    { id: 'missing-1', title: 'Missing archive', submittedAt: '2026-10-18T10:15:00.000Z' },
  ];
  const campaigns = {
    'draft-1': { id: 'draft-1', title: 'Still a draft', localStatus: 'draft' },
  };

  assert.deepEqual(recoverArchivedSubmissionEvents([], submissions, campaigns, 'fallback-time'), []);
});

test('recovers a legacy anonymous submission honestly and repeated Activity reads do not duplicate it', () => {
  const submission = { id: 'legacy-anon-1', title: 'Neighborhood garden', submittedAt: '2025-05-01T09:00:00.000Z', anonymousLegacy: true };
  const campaign = { id: submission.id, title: submission.title, localStatus: 'submitted_locally' };
  const firstRead = recoverArchivedSubmissionEvents([], [submission], { [submission.id]: campaign }, 'fallback-time');
  const secondRead = recoverArchivedSubmissionEvents(firstRead, [submission], { [submission.id]: campaign }, 'later-time');

  assert.equal(firstRead.length, 1);
  assert.equal(firstRead[0].metadata.recoveredFromAnonymousDevice, true);
  assert.equal(firstRead[0].campaignTitle, submission.title);
  assert.equal(secondRead.length, 1);
  assert.equal(secondRead[0].createdAt, submission.submittedAt);
});

test('web localStorage submission archive and index recover into Activity on repeated reads', async () => {
  const values = new Map();
  const storage = {
    get length() { return values.size; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    key(index) { return [...values.keys()][index] ?? null; },
  };
  const ownerId = 'web-user-123';
  const campaign = { id: 'web-campaign-1', version: 1, localStatus: 'submitted_locally', title: 'Browser garden', category: 'Community', creatorName: 'Creator', sections: [] };

  const draft = { ...campaign, localStatus: 'draft', title: 'Browser garden draft' };
  webStorageCore.writeCampaignDraft(storage, ownerId, JSON.stringify(draft));
  assert.equal(JSON.parse(webStorageCore.readCampaignDraft(storage, ownerId)).title, 'Browser garden draft');
  await webStorageCore.writeCampaignSubmission(storage, ownerId, campaign);
  const index = webStorageCore.readCampaignSubmissions(storage, ownerId);
  const archived = webStorageCore.readCampaignSubmission(storage, ownerId, campaign.id);
  assert.equal(index.length, 1);
  assert.equal(archived.id, campaign.id);
  assert.equal(storage.getItem(`signal.campaign.draft.v1.${ownerId}.submitted.${campaign.id}`) !== null, true);
  assert.equal(storage.getItem(`signal.campaign.draft.v1.${ownerId}.submitted-index`) !== null, true);
  const diagnostic = webStorageCore.inspectCampaignStorage(storage, [ownerId]);
  assert.equal(diagnostic.campaignStorageKeyCount, 3);
  assert.equal(diagnostic.namespaces[0].submittedRecordCount, 1);

  const currentEvents = [];
  const submissions = index.map((entry) => ({ ...entry, anonymousLegacy: false }));
  const campaignsById = { [archived.id]: archived };
  const firstRead = recoverArchivedSubmissionEvents(currentEvents, submissions, campaignsById, 'fallback');
  const secondRead = recoverArchivedSubmissionEvents(firstRead, submissions, campaignsById, 'later');
  assert.equal(firstRead.length, 1);
  assert.equal(firstRead[0].campaignTitle, 'Browser garden');
  assert.equal(secondRead.length, 1);
});

test('web localStorage Activity reads the submitted event and does not duplicate it beside API data', async () => {
  const values = new Map();
  const storage = {
    get length() { return values.size; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    key(index) { return [...values.keys()][index] ?? null; },
  };
  const ownerId = 'web-user-activity';
  const campaign = { id: 'web-campaign-activity', localStatus: 'submitted_locally', title: 'Browser river cleanup', category: 'Environment', creatorName: 'Creator', sections: [] };
  await webStorageCore.writeCampaignSubmission(storage, ownerId, campaign);
  const event = { id: `local:campaign.submitted:${campaign.id}`, eventType: 'campaign.submitted', campaignId: campaign.id, campaignTitle: campaign.title, createdAt: '2026-10-18T10:00:00.000Z', metadata: {} };
  webStorageCore.writeCampaignDraft(storage, `${ownerId}.activity-events.v1`, JSON.stringify([event]));

  const activityRaw = webStorageCore.readCampaignDraft(storage, `${ownerId}.activity-events.v1`);
  const localEvents = JSON.parse(activityRaw);
  const apiEvents = [{ ...event, id: 'api-event-1', source: 'api' }];
  const recovered = recoverArchivedSubmissionEvents(localEvents, webStorageCore.readCampaignSubmissions(storage, ownerId), { [campaign.id]: webStorageCore.readCampaignSubmission(storage, ownerId, campaign.id) }, 'fallback');
  const merged = mergeAccountEvents([{ ...event, source: 'on-device' }], apiEvents);

  assert.equal(localEvents.length, 1);
  assert.equal(recovered.length, 1);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].source, 'api');
});

test('Activity feed excludes fictional demo sources and preserves the real library campaign API event', () => {
  const activitySource = fs.readFileSync(path.join(__dirname, '../../src/app/(tabs)/activity.tsx'), 'utf8');
  assert.doesNotMatch(activitySource, /readCampaignDemoContributions|demoContributionEvents|const events:\s*ActivityEvent\[\]/);
  assert.doesNotMatch(activitySource, /source:\s*'demo'/);

  const localEvent = {
    id: 'local:campaign.submitted:library-campaign',
    campaignId: 'library-campaign',
    campaignTitle: 'Every Child Deserves a Library',
    eventType: 'campaign.submitted',
    source: 'on-device',
    date: '2026-10-19',
  };
  const apiEvent = {
    ...localEvent,
    id: 'signal-api-event-123',
    source: 'api',
    description: 'Every Child Deserves a Library · campaign submitted.',
  };
  const feed = mergeAccountEvents([localEvent], [apiEvent]);

  assert.equal(feed.length, 1);
  assert.equal(feed[0].campaignTitle, 'Every Child Deserves a Library');
  assert.equal(feed[0].source, 'api');
  assert.deepEqual(mergeAccountEvents([], []), []);
});

test('web Create submission persists a campaign and Activity event across repeated reads and module reload', async () => {
  const values = new Map();
  const storage = {
    get length() { return values.size; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    key(index) { return [...values.keys()][index] ?? null; },
  };
  const previousStorage = globalThis.localStorage;
  const previousWindow = globalThis.window;
  const dispatchedEvents = [];
  globalThis.localStorage = storage;
  globalThis.window = { dispatchEvent(event) { dispatchedEvents.push(event.type); return true; } };
  try {
    const ownerId = 'web-user-submission-flow';
    const draft = { id: 'web-campaign-submit', version: 1, currentStep: 5, localStatus: 'draft', title: 'Coastal habitat care', category: 'Environment', creatorName: 'Coast Collective', sections: [], fundingGoal: '5000' };
    const submitted = { ...draft, localStatus: 'submitted_locally', apiSubmissionStatus: 'local_only' };
    const localActivity = loadTypeScriptModule('data/local-activity.ts', {
      '@/data/campaign-draft-storage': webStorage,
      '@/data/campaigns': campaignsModule,
      '@/data/local-activity-core': require('../../src/data/local-activity-core'),
      '@/types/local-campaign': localCampaignTypes,
    });

    await webStorage.writeCampaignDraft(ownerId, JSON.stringify(draft));
    assert.equal(JSON.parse(await webStorage.readCampaignDraft(ownerId)).title, draft.title);
    await webStorage.writeCampaignDraft(ownerId, JSON.stringify(submitted));
    await webStorage.writeCampaignSubmission(ownerId, submitted);
    await localActivity.recordLocalCampaignSubmission(ownerId, submitted);

    const firstRead = await localActivity.readLocalActivityEvents(ownerId);
    const repeatedRead = await localActivity.readLocalActivityEvents(ownerId);
    const reloadedActivity = loadTypeScriptModule('data/local-activity.ts', {
      '@/data/campaign-draft-storage': webStorage,
      '@/data/local-activity-core': require('../../src/data/local-activity-core'),
      '@/types/local-campaign': localCampaignTypes,
    });
    const afterReload = await reloadedActivity.readLocalActivityEvents(ownerId);

    assert.equal(firstRead.length, 1);
    assert.equal(firstRead[0].campaignTitle, submitted.title);
    assert.equal(firstRead[0].eventType, 'campaign.submitted');
    assert.equal(repeatedRead.length, 1);
    assert.equal(afterReload.length, 1);
    assert.equal((await webStorage.readCampaignSubmission(ownerId, submitted.id)).id, submitted.id);
    assert.deepEqual(dispatchedEvents, ['signal:activity-updated']);
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('recordLocalContribution persists a simulated contribution and does not duplicate on retry or reload', async () => {
  const values = new Map();
  const storage = {
    get length() { return values.size; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    key(index) { return [...values.keys()][index] ?? null; },
  };
  const previousStorage = globalThis.localStorage;
  const previousWindow = globalThis.window;
  const dispatchedEvents = [];
  globalThis.localStorage = storage;
  globalThis.window = { dispatchEvent(event) { dispatchedEvents.push(event.type); return true; } };

  try {
    const ownerId = 'device-draft';
    const contribution = {
      id: 'demo-contrib-123',
      campaignId: 'pages-for-all-library',
      amountMinor: 2500,
      currency: 'USD',
      status: 'simulated',
      createdAt: '2026-10-20T12:00:00.000Z',
      idempotencyKey: 'flow-key-123',
      showFirstName: true,
      displayFirstName: 'Alex',
    };
    const localActivity = loadTypeScriptModule('data/local-activity.ts', {
      '@/data/campaign-draft-storage': webStorage,
      '@/data/campaigns': campaignsModule,
      '@/data/local-activity-core': require('../../src/data/local-activity-core'),
      '@/types/local-campaign': localCampaignTypes,
    });

    await localActivity.recordLocalContribution(ownerId, contribution, 'Every Child Deserves a Library');

    const firstRead = await localActivity.readLocalActivityEvents(ownerId);
    assert.equal(firstRead.length, 1);
    assert.equal(firstRead[0].eventType, 'contribution.simulated');
    assert.equal(firstRead[0].campaignId, 'pages-for-all-library');
    assert.equal(firstRead[0].campaignTitle, 'Every Child Deserves a Library');
    assert.equal(firstRead[0].metadata.amountMinor, 2500);
    assert.equal(firstRead[0].metadata.contributionId, 'demo-contrib-123');

    // Repeated call with the same contribution does not duplicate
    await localActivity.recordLocalContribution(ownerId, contribution, 'Every Child Deserves a Library');
    const repeatedRead = await localActivity.readLocalActivityEvents(ownerId);
    assert.equal(repeatedRead.length, 1);

    // Module reload continues to read the saved contribution
    const reloadedActivity = loadTypeScriptModule('data/local-activity.ts', {
      '@/data/campaign-draft-storage': webStorage,
      '@/data/local-activity-core': require('../../src/data/local-activity-core'),
      '@/types/local-campaign': localCampaignTypes,
    });
    const afterReload = await reloadedActivity.readLocalActivityEvents(ownerId);
    assert.equal(afterReload.length, 1);
    assert.equal(afterReload[0].metadata.contributionId, 'demo-contrib-123');
    assert.equal(dispatchedEvents.includes('signal:activity-updated'), true);
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('mergeAccountEvents merges local and API contribution events by actionId without duplicating', () => {
  const localEvent = {
    id: 'local:contribution:demo-contrib-123',
    campaignId: 'pages-for-all-library',
    campaignTitle: 'Every Child Deserves a Library',
    eventType: 'contribution.simulated',
    source: 'on-device',
    actionId: 'demo-contrib-123',
    date: '2026-10-20',
  };
  const apiEvent = {
    ...localEvent,
    id: 'signal-api-event-456',
    source: 'api',
    description: 'A simulated contribution of $25.00 was recorded for “Every Child Deserves a Library”. No payment was processed.',
  };
  const feed = mergeAccountEvents([localEvent], [apiEvent]);

  assert.equal(feed.length, 1);
  assert.equal(feed[0].actionId, 'demo-contrib-123');
  assert.equal(feed[0].source, 'api');
});

test('recordLocalContribution stores and retrieves contribution event correctly', async () => {
  const values = new Map();
  const storage = {
    get length() { return values.size; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    key(index) { return [...values.keys()][index] ?? null; },
  };
  const previousStorage = globalThis.localStorage;
  const previousWindow = globalThis.window;
  const dispatchedEvents = [];
  globalThis.localStorage = storage;
  globalThis.window = { dispatchEvent(event) { dispatchedEvents.push(event.type); return true; } };

  try {
    const ownerId = 'test-user-123';
    const contribution = {
      id: 'demo-contrib-test-456',
      campaignId: 'pages-for-all-library',
      amountMinor: 5000,
      currency: 'USD',
      status: 'simulated',
      createdAt: '2026-10-20T14:30:00.000Z',
      idempotencyKey: 'test-flow-key-789',
      showFirstName: true,
      displayFirstName: 'Taylor',
    };
    const localActivity = loadTypeScriptModule('data/local-activity.ts', {
      '@/data/campaign-draft-storage': webStorage,
      '@/data/campaigns': campaignsModule,
      '@/data/local-activity-core': require('../../src/data/local-activity-core'),
      '@/types/local-campaign': localCampaignTypes,
    });

    // Record the contribution
    await localActivity.recordLocalContribution(ownerId, contribution, 'Every Child Deserves a Library');

    // Read back the events
    const events = await localActivity.readLocalActivityEvents(ownerId);

    // Verify the contribution event was recorded
    assert.equal(events.length, 1);
    assert.equal(events[0].eventType, 'contribution.simulated');
    assert.equal(events[0].campaignId, 'pages-for-all-library');
    assert.equal(events[0].campaignTitle, 'Every Child Deserves a Library');
    assert.equal(events[0].metadata.contributionId, 'demo-contrib-test-456');
    assert.equal(events[0].metadata.amountMinor, 5000);
    assert.equal(events[0].metadata.idempotencyKey, 'test-flow-key-789');
    assert.equal(events[0].metadata.displayFirstName, 'Taylor');
    assert.equal(events[0].metadata.showFirstName, true);

    // Verify the storage key was used correctly
    const storageKey = `${ownerId}.activity-events.v1`;
    const storedRaw = webStorageCore.readCampaignDraft(storage, storageKey);
    assert.ok(storedRaw, 'Activity events should be stored');
    const storedEvents = JSON.parse(storedRaw);
    assert.equal(storedEvents.length, 1);
    assert.equal(storedEvents[0].id, 'local:contribution:demo-contrib-test-456');

    assert.ok(dispatchedEvents.includes('signal:activity-updated'));
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('recordLocalContribution with device-draft owner stores correctly', async () => {
  const values = new Map();
  const storage = {
    get length() { return values.size; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    key(index) { return [...values.keys()][index] ?? null; },
  };
  const previousStorage = globalThis.localStorage;
  const previousWindow = globalThis.window;
  globalThis.localStorage = storage;
  globalThis.window = { dispatchEvent(event) { return true; } };

  try {
    const ownerId = 'device-draft';
    const contribution = {
      id: 'demo-contrib-device-789',
      campaignId: 'pages-for-all-library',
      amountMinor: 2500,
      currency: 'USD',
      status: 'simulated',
      createdAt: '2026-10-20T15:00:00.000Z',
      idempotencyKey: 'device-flow-key-999',
      showFirstName: false,
    };
    const localActivity = loadTypeScriptModule('data/local-activity.ts', {
      '@/data/campaign-draft-storage': webStorage,
      '@/data/campaigns': campaignsModule,
      '@/data/local-activity-core': require('../../src/data/local-activity-core'),
      '@/types/local-campaign': localCampaignTypes,
    });

    // Record with device-draft owner (no signed-in user)
    await localActivity.recordLocalContribution(ownerId, contribution, 'Every Child Deserves a Library');

    // Read back with device-draft owner
    const events = await localActivity.readLocalActivityEvents(ownerId);

    assert.equal(events.length, 1);
    assert.equal(events[0].eventType, 'contribution.simulated');
    assert.equal(events[0].campaignId, 'pages-for-all-library');
    assert.equal(events[0].metadata.contributionId, 'demo-contrib-device-789');
    assert.equal(events[0].metadata.amountMinor, 2500);
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('contribution in demo ledger is recovered and appears in activity', async () => {
  const values = new Map();
  const storage = {
    get length() { return values.size; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    key(index) { return [...values.keys()][index] ?? null; },
  };
  const previousStorage = globalThis.localStorage;
  const previousWindow = globalThis.window;
  globalThis.localStorage = storage;
  globalThis.window = { dispatchEvent(event) { return true; } };

  try {
    const ownerId = 'device-draft';
    const campaignId = 'pages-for-all-library';
    const contribution = {
      id: 'demo-ledger-abc-123',
      campaignId,
      amountMinor: 1000,
      currency: 'USD',
      status: 'simulated',
      createdAt: '2026-10-20T16:00:00.000Z',
      idempotencyKey: 'ledger-flow-key-xyz',
      showFirstName: true,
      displayFirstName: 'Jordan',
    };

    // Simulate what addDemoContribution does: store in the shared ledger
    const ledgerKey = `device.demo-contributions.v2.${campaignId}`;
    const existingLedger = webStorageCore.readCampaignDraft(storage, ledgerKey);
    const ledgerData = existingLedger ? JSON.parse(existingLedger) : [];
    ledgerData.push(contribution);
    webStorageCore.writeCampaignDraft(storage, ledgerKey, JSON.stringify(ledgerData));

    // Now read activity events - it should recover from the ledger
    const localActivity = loadTypeScriptModule('data/local-activity.ts', {
      '@/data/campaign-draft-storage': webStorage,
      '@/data/campaigns': campaignsModule,
      '@/data/local-activity-core': require('../../src/data/local-activity-core'),
      '@/types/local-campaign': localCampaignTypes,
    });

    const events = await localActivity.readLocalActivityEvents(ownerId);

    // The contribution should be recovered from the ledger
    assert.ok(events.length >= 1, 'At least one event should be recovered');
    const contributionEvent = events.find((e) => e.eventType === 'contribution.simulated' && e.metadata.contributionId === 'demo-ledger-abc-123');
    assert.ok(contributionEvent, 'Contribution event should be recovered from ledger');
    assert.equal(contributionEvent.campaignId, campaignId);
    assert.equal(contributionEvent.campaignTitle, 'Every Child Deserves a Library');
    assert.equal(contributionEvent.metadata.amountMinor, 1000);
    assert.equal(contributionEvent.metadata.contributionId, 'demo-ledger-abc-123');
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('recordLocalContribution writes to activity events storage, not just ledger', async () => {
  const values = new Map();
  const storage = {
    get length() { return values.size; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    key(index) { return [...values.keys()][index] ?? null; },
  };
  const previousStorage = globalThis.localStorage;
  const previousWindow = globalThis.window;
  globalThis.localStorage = storage;
  globalThis.window = { dispatchEvent(event) { return true; } };

  try {
    const ownerId = 'test-user-direct';
    const campaignId = 'pages-for-all-library';
    const contribution = {
      id: 'direct-record-xyz-789',
      campaignId,
      amountMinor: 7500,
      currency: 'USD',
      status: 'simulated',
      createdAt: '2026-10-20T17:00:00.000Z',
      idempotencyKey: 'direct-flow-key-123',
      showFirstName: false,
    };
    const localActivity = loadTypeScriptModule('data/local-activity.ts', {
      '@/data/campaign-draft-storage': webStorage,
      '@/data/campaigns': campaignsModule,
      '@/data/local-activity-core': require('../../src/data/local-activity-core'),
      '@/types/local-campaign': localCampaignTypes,
    });

    // Record the contribution directly
    await localActivity.recordLocalContribution(ownerId, contribution, 'Every Child Deserves a Library');

    // Check that it's in the activity events storage
    const activityKey = `${ownerId}.activity-events.v1`;
    const activityRaw = webStorageCore.readCampaignDraft(storage, activityKey);
    assert.ok(activityRaw, 'Activity events should be stored');
    const activityEvents = JSON.parse(activityRaw);
    assert.equal(activityEvents.length, 1);
    assert.equal(activityEvents[0].id, 'local:contribution:direct-record-xyz-789');
    assert.equal(activityEvents[0].eventType, 'contribution.simulated');

    // Check that it's NOT in the ledger (recordLocalContribution doesn't write to ledger)
    const ledgerKey = `device.demo-contributions.v2.${campaignId}`;
    const ledgerRaw = webStorageCore.readCampaignDraft(storage, ledgerKey);
    assert.ok(!ledgerRaw, 'Ledger should not have data from recordLocalContribution');
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('contribution recorded then read back returns correct event', async () => {
  const values = new Map();
  const storage = {
    get length() { return values.size; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    key(index) { return [...values.keys()][index] ?? null; },
  };
  const previousStorage = globalThis.localStorage;
  const previousWindow = globalThis.window;
  globalThis.localStorage = storage;
  globalThis.window = { dispatchEvent(event) { return true; } };

  try {
    const ownerId = 'test-user-flow';
    const contribution = {
      id: 'flow-test-123',
      campaignId: 'pages-for-all-library',
      amountMinor: 3000,
      currency: 'USD',
      status: 'simulated',
      createdAt: '2026-10-20T18:00:00.000Z',
      idempotencyKey: 'flow-test-key',
      showFirstName: true,
      displayFirstName: 'Morgan',
    };
    const localActivity = loadTypeScriptModule('data/local-activity.ts', {
      '@/data/campaign-draft-storage': webStorage,
      '@/data/campaigns': campaignsModule,
      '@/data/local-activity-core': require('../../src/data/local-activity-core'),
      '@/types/local-campaign': localCampaignTypes,
    });

    // Simulate the actual flow: record contribution
    await localActivity.recordLocalContribution(ownerId, contribution, 'Every Child Deserves a Library');

    // Then read it back (as Activity screen would)
    const events = await localActivity.readLocalActivityEvents(ownerId);

    // Verify it's there
    assert.equal(events.length, 1);
    assert.equal(events[0].eventType, 'contribution.simulated');
    assert.equal(events[0].campaignId, 'pages-for-all-library');
    assert.equal(events[0].campaignTitle, 'Every Child Deserves a Library');
    assert.equal(events[0].metadata.contributionId, 'flow-test-123');
    assert.equal(events[0].metadata.amountMinor, 3000);
    assert.equal(events[0].metadata.displayFirstName, 'Morgan');
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('recordLocalContribution with undefined userId uses device-draft fallback', async () => {
  const values = new Map();
  const storage = {
    get length() { return values.size; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    key(index) { return [...values.keys()][index] ?? null; },
  };
  const previousStorage = globalThis.localStorage;
  const previousWindow = globalThis.window;
  globalThis.localStorage = storage;
  globalThis.window = { dispatchEvent(event) { return true; } };

  try {
    const userId = undefined; // Simulate no signed-in user
    const contribution = {
      id: 'undefined-user-test-456',
      campaignId: 'pages-for-all-library',
      amountMinor: 2000,
      currency: 'USD',
      status: 'simulated',
      createdAt: '2026-10-20T19:00:00.000Z',
      idempotencyKey: 'undefined-user-key',
      showFirstName: false,
    };
    const localActivity = loadTypeScriptModule('data/local-activity.ts', {
      '@/data/campaign-draft-storage': webStorage,
      '@/data/campaigns': campaignsModule,
      '@/data/local-activity-core': require('../../src/data/local-activity-core'),
      '@/types/local-campaign': localCampaignTypes,
    });

    // Record with undefined userId (should fall back to device-draft)
    await localActivity.recordLocalContribution(userId, contribution, 'Every Child Deserves a Library');

    // Read with device-draft (the fallback owner)
    const events = await localActivity.readLocalActivityEvents('device-draft');

    // Verify it's in device-draft storage
    assert.equal(events.length, 1);
    assert.equal(events[0].eventType, 'contribution.simulated');
    assert.equal(events[0].metadata.contributionId, 'undefined-user-test-456');

    // Verify the actual storage key used
    const deviceDraftKey = 'device-draft.activity-events.v1';
    const deviceDraftRaw = webStorageCore.readCampaignDraft(storage, deviceDraftKey);
    assert.ok(deviceDraftRaw, 'Should be stored under device-draft key');
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('simulates full contribution flow with no signed-in user', async () => {
  const values = new Map();
  const storage = {
    get length() { return values.size; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    key(index) { return [...values.keys()][index] ?? null; },
  };
  const previousStorage = globalThis.localStorage;
  const previousWindow = globalThis.window;
  globalThis.localStorage = storage;
  globalThis.window = { dispatchEvent(event) { return true; } };

  try {
    const userId = undefined; // No signed-in user
    const campaignId = 'pages-for-all-library';
    const contribution = {
      id: 'full-flow-no-user-abc',
      campaignId,
      amountMinor: 1500,
      currency: 'USD',
      status: 'simulated',
      createdAt: '2026-10-20T20:00:00.000Z',
      idempotencyKey: 'full-flow-no-user-key',
      showFirstName: true,
      displayFirstName: 'Casey',
    };
    const localActivity = loadTypeScriptModule('data/local-activity.ts', {
      '@/data/campaign-draft-storage': webStorage,
      '@/data/campaigns': campaignsModule,
      '@/data/local-activity-core': require('../../src/data/local-activity-core'),
      '@/types/local-campaign': localCampaignTypes,
    });

    // Simulate what contribution-processing.ts does (line 71)
    await localActivity.recordLocalContribution(userId || 'device-draft', contribution, 'Every Child Deserves a Library');

    // Then Activity screen would read with device-draft (since userId is undefined)
    const ownerId = userId || 'device-draft';
    const events = await localActivity.readLocalActivityEvents(ownerId);

    // Verify the contribution appears
    assert.ok(events.length >= 1, 'Should have at least one event');
    const contributionEvent = events.find((e) => e.eventType === 'contribution.simulated' && e.metadata.contributionId === 'full-flow-no-user-abc');
    assert.ok(contributionEvent, 'Contribution should be visible in activity');
    assert.equal(contributionEvent.campaignTitle, 'Every Child Deserves a Library');
    assert.equal(contributionEvent.metadata.amountMinor, 1500);
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('contribution with catalog campaign ID not in CATALOG_CAMPAIGNS still appears', async () => {
  const values = new Map();
  const storage = {
    get length() { return values.size; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    key(index) { return [...values.keys()][index] ?? null; },
  };
  const previousStorage = globalThis.localStorage;
  const previousWindow = globalThis.window;
  globalThis.localStorage = storage;
  globalThis.window = { dispatchEvent(event) { return true; } };

  try {
    const ownerId = 'device-draft';
    // Use a campaign ID that exists in discoveryCampaigns but test the direct recording path
    const campaignId = 'green-bengaluru-lakes';
    const contribution = {
      id: 'green-lakes-test-123',
      campaignId,
      amountMinor: 4000,
      currency: 'USD',
      status: 'simulated',
      createdAt: '2026-10-20T21:00:00.000Z',
      idempotencyKey: 'green-lakes-key',
      showFirstName: false,
    };
    const localActivity = loadTypeScriptModule('data/local-activity.ts', {
      '@/data/campaign-draft-storage': webStorage,
      '@/data/campaigns': campaignsModule,
      '@/data/local-activity-core': require('../../src/data/local-activity-core'),
      '@/types/local-campaign': localCampaignTypes,
    });

    // Record the contribution directly
    await localActivity.recordLocalContribution(ownerId, contribution, "Our Lakes Aren't Dumping Grounds");

    // Read it back
    const events = await localActivity.readLocalActivityEvents(ownerId);

    // Verify it appears (even though it's not recovered from ledger, it's directly recorded)
    assert.ok(events.length >= 1, 'Should have at least one event');
    const contributionEvent = events.find((e) => e.eventType === 'contribution.simulated' && e.metadata.contributionId === 'green-lakes-test-123');
    assert.ok(contributionEvent, 'Contribution should be visible');
    assert.equal(contributionEvent.campaignId, 'green-bengaluru-lakes');
    assert.equal(contributionEvent.campaignTitle, "Our Lakes Aren't Dumping Grounds");
  } finally {
    if (previousStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = previousStorage;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
