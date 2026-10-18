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
