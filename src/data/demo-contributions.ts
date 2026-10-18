import { readCampaignDraft, writeCampaignDraft } from '@/data/campaign-draft-storage';
import type { LocalDemoContribution } from '@/types/local-campaign';

const MAX_RECORDS_PER_CAMPAIGN = 150;
const MAX_LEDGER_SIZE = 48_000;
const writeQueues = new Map<string, Promise<void>>();

// Shared device ledger makes fictional campaign owners and supporters independent of
// whichever real account happens to be signed in. The old user-scoped key is retained
// as a read-only compatibility source; it is never cleared or overwritten.
function sharedStorageKey(campaignId: string): string {
  return `device.demo-contributions.v2.${campaignId}`;
}

function legacyStorageKey(userId: string, campaignId: string): string {
  return `${userId}.demo-contributions.${campaignId}`;
}

function isDemoContribution(value: unknown, campaignId: string): value is LocalDemoContribution {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<LocalDemoContribution>;
  return record.campaignId === campaignId
    && typeof record.id === 'string'
    && Number.isSafeInteger(record.amountMinor) && Number(record.amountMinor) > 0
    && record.currency === 'USD'
    && record.status === 'simulated'
    && typeof record.idempotencyKey === 'string'
    && typeof record.createdAt === 'string';
}

async function readLedger(key: string, campaignId: string): Promise<LocalDemoContribution[]> {
  const raw = await readCampaignDraft(key);
  if (!raw || raw.length > MAX_LEDGER_SIZE) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is LocalDemoContribution => isDemoContribution(item, campaignId)) : [];
  } catch { return []; }
}

function mergeRecords(...groups: LocalDemoContribution[][]): LocalDemoContribution[] {
  const records = new Map<string, LocalDemoContribution>();
  for (const group of groups) for (const item of group) records.set(item.id, item);
  return [...records.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

/** Device-wide records for a fictional campaign, used by the details and Activity screens. */
export async function readCampaignDemoContributions(campaignId: string): Promise<LocalDemoContribution[]> {
  return readLedger(sharedStorageKey(campaignId), campaignId);
}

/** Shared campaign ledger plus this user's legacy records for backward compatibility. */
export async function readDemoContributions(userId: string, campaignId: string): Promise<LocalDemoContribution[]> {
  const [shared, legacy] = await Promise.all([
    readLedger(sharedStorageKey(campaignId), campaignId),
    readLedger(legacyStorageKey(userId, campaignId), campaignId),
  ]);
  return mergeRecords(shared, legacy);
}

/** Append-only local demo ledger with a per-campaign queue and idempotency key. */
export async function addDemoContribution(
  contributorId: string,
  campaignId: string,
  amountMinor: number,
  idempotencyKey: string,
  contributorName = 'Demo supporter',
): Promise<LocalDemoContribution> {
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new Error('Choose a valid contribution amount.');
  if (!contributorId.trim()) throw new Error('A demo supporter identity is required.');
  if (!idempotencyKey.trim()) throw new Error('A contribution confirmation key is required.');

  const storageKey = sharedStorageKey(campaignId);
  const previous = writeQueues.get(storageKey) ?? Promise.resolve();
  let result: LocalDemoContribution | null = null;
  const task = previous.catch(() => undefined).then(async () => {
    const records = await readDemoContributions(contributorId, campaignId);
    const existing = records.find((item) => item.idempotencyKey === idempotencyKey);
    if (existing) { result = existing; return; }
    if (records.length >= MAX_RECORDS_PER_CAMPAIGN) throw new Error('This demo ledger has reached its local limit.');

    const contribution: LocalDemoContribution = {
      id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      campaignId,
      amountMinor,
      currency: 'USD',
      status: 'simulated',
      contributorId,
      contributorName: contributorName.trim().slice(0, 80) || 'Demo supporter',
      idempotencyKey,
      createdAt: new Date().toISOString(),
    };
    // Merge rather than replace so existing shared and legacy records remain accessible.
    const currentShared = await readCampaignDemoContributions(campaignId);
    const updated = mergeRecords(currentShared, records, [contribution]);
    await writeCampaignDraft(storageKey, JSON.stringify(updated));
    result = contribution;
  });
  writeQueues.set(storageKey, task);
  try {
    await task;
    if (!result) throw new Error('The demo contribution could not be saved.');
    return result;
  } finally {
    if (writeQueues.get(storageKey) === task) writeQueues.delete(storageKey);
  }
}
