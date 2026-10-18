const KEY_PREFIX = 'signal.campaign.draft.v1';
const MAX_DRAFT_SIZE = 48_000;

function storageKey(ownerOrSuffix: string): string {
  return `${KEY_PREFIX}.${ownerOrSuffix}`;
}

export function getBrowserStorage(): Storage | undefined {
  try { return globalThis.localStorage; } catch { return undefined; }
}

export function readCampaignDraft(storage: Storage | undefined, ownerOrSuffix: string): string | null {
  try { return storage?.getItem(storageKey(ownerOrSuffix)) ?? null; } catch { return null; }
}

export function writeCampaignDraft(storage: Storage | undefined, ownerOrSuffix: string, value: string): void {
  if (!storage) throw new Error('Browser storage is unavailable.');
  if (value.length > MAX_DRAFT_SIZE) throw new Error('Draft is too large.');
  storage.setItem(storageKey(ownerOrSuffix), value);
}

export function readCampaignSubmissions(storage: Storage | undefined, userId: string): Array<{ id: string; title: string; category: string; creatorName: string; submittedAt: string }> {
  const raw = readCampaignDraft(storage, `${userId}.submitted-index`);
  if (raw && raw.length > MAX_DRAFT_SIZE) return [];
  try {
    const values: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(values)) return [];
    const entries = values.filter((item): item is { id: string; title: string; category: string; creatorName: string; submittedAt: string } => Boolean(
      item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.submittedAt === 'string',
    ));
    const activeRaw = readCampaignDraft(storage, userId);
    if (activeRaw && activeRaw.length <= MAX_DRAFT_SIZE) {
      try {
        const campaign = JSON.parse(activeRaw);
        if (campaign?.localStatus === 'submitted_locally' && typeof campaign.id === 'string' && !entries.some((item) => item.id === campaign.id)) {
          entries.unshift({ id: campaign.id, title: campaign.title, category: campaign.category, creatorName: campaign.creatorName, submittedAt: '' });
        }
      } catch { /* Keep a valid index if the active record is malformed. */ }
    }
    return entries.slice(0, 25);
  } catch { return []; }
}

export async function writeCampaignSubmission(storage: Storage | undefined, userId: string, campaign: { id: string; title: string; category: string; creatorName: string }): Promise<void> {
  const current = readCampaignSubmissions(storage, userId);
  const entry = { id: campaign.id, title: campaign.title, category: campaign.category, creatorName: campaign.creatorName, submittedAt: new Date().toISOString() };
  writeCampaignDraft(storage, `${userId}.submitted.${campaign.id}`, JSON.stringify(campaign));
  writeCampaignDraft(storage, `${userId}.submitted-index`, JSON.stringify([entry, ...current.filter((item) => item.id !== campaign.id)].slice(0, 25)));
}

export function readCampaignSubmission(storage: Storage | undefined, userId: string, campaignId: string): unknown | null {
  const raw = readCampaignDraft(storage, `${userId}.submitted.${campaignId}`) ?? readCampaignDraft(storage, userId);
  if (!raw || raw.length > MAX_DRAFT_SIZE) return null;
  try {
    const campaign: unknown = JSON.parse(raw);
    return campaign && typeof campaign === 'object' && (campaign as { localStatus?: string }).localStatus === 'submitted_locally' ? campaign : null;
  } catch { return null; }
}

export function inspectCampaignStorage(storage: Storage | undefined, ownerIds: string[]) {
  const owners = [...new Set(ownerIds)];
  const keys: Array<string | null> = [];
  let keyEnumerationAvailable = Boolean(storage);
  try { if (storage) for (let i = 0; i < storage.length; i += 1) keys.push(storage.key(i)); }
  catch { keyEnumerationAvailable = false; }
  const keyCount = keys.filter((key) => key?.startsWith(`${KEY_PREFIX}.`)).length;
  const knownPrefixes = owners.map((ownerId) => storageKey(`${ownerId}.`));
  const otherOwnerKeyCount = keys.filter((key) => key?.startsWith(`${KEY_PREFIX}.`) && !knownPrefixes.some((prefix) => key.startsWith(prefix))).length;
  const namespaces = owners.map((ownerId) => {
    const activeKey = storageKey(ownerId);
    const indexKey = storageKey(`${ownerId}.submitted-index`);
    const activityKey = storageKey(`${ownerId}.activity-events.v1`);
    const archivePrefix = storageKey(`${ownerId}.submitted.`);
    const archiveKeys = keys.filter((key) => key?.startsWith(archivePrefix));
    const submittedArchiveCount = archiveKeys.reduce((count, key) => {
      try { return count + (JSON.parse(storage?.getItem(key!) || 'null')?.localStatus === 'submitted_locally' ? 1 : 0); } catch { return count; }
    }, 0);
    const activeRaw = readCampaignDraft(storage, ownerId);
    let activeSubmitted = false;
    try { activeSubmitted = JSON.parse(activeRaw || 'null')?.localStatus === 'submitted_locally'; } catch { /* No submitted active record. */ }
    let indexCount = 0;
    try { const index = JSON.parse(readCampaignDraft(storage, `${ownerId}.submitted-index`) || '[]'); indexCount = Array.isArray(index) ? index.length : 0; } catch { /* Diagnostic is read-only. */ }
    let eventCount = 0;
    try { const events = JSON.parse(readCampaignDraft(storage, `${ownerId}.activity-events.v1`) || '[]'); eventCount = Array.isArray(events) ? events.length : 0; } catch { /* Diagnostic is read-only. */ }
    return { ownerId, activeRecordPresent: activeRaw !== null, activeSubmitted, submittedRecordCount: submittedArchiveCount + (activeSubmitted ? 1 : 0), submissionIndexPresent: readCampaignDraft(storage, `${ownerId}.submitted-index`) !== null, indexedSubmissionCount: indexCount, archiveCount: archiveKeys.length, activityRecordPresent: readCampaignDraft(storage, `${ownerId}.activity-events.v1`) !== null, storedActivityEventCount: eventCount, activeKey, indexKey, activityKey };
  });
  return { available: keyEnumerationAvailable, campaignStorageKeyCount: keyCount, otherOwnerKeyCount, namespaces };
}
