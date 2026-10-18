import * as SecureStore from 'expo-secure-store';
import { normalizeLocalCampaignDraft, type LocalCampaignDraft, type LocalCampaignIndexEntry } from '@/types/local-campaign';

const KEY_PREFIX = 'signal.campaign.draft.v1';
// Keep UTF-8 payloads below SecureStore's historically small per-value limits.
const CHUNK_SIZE = 400;
const MAX_DRAFT_SIZE = 48_000;

/** Drafts are split into small SecureStore values to avoid platform payload limits. */
export async function readCampaignDraft(userId: string): Promise<string | null> {
  const key = `${KEY_PREFIX}.${userId}`;
  const manifest = await SecureStore.getItemAsync(`${key}.manifest`);
  if (!manifest) return null;
  let parsed: { generation?: unknown; count?: unknown };
  try { parsed = JSON.parse(manifest) as { generation?: unknown; count?: unknown }; } catch { return null; }
  const generation = typeof parsed.generation === 'string' && /^[0-9a-z-]+$/.test(parsed.generation) ? parsed.generation : '';
  const chunks = Number(parsed.count);
  if (!generation || !Number.isInteger(chunks) || chunks < 1 || chunks > Math.ceil(MAX_DRAFT_SIZE / CHUNK_SIZE)) return null;
  const values = await Promise.all(Array.from({ length: chunks }, (_, index) => SecureStore.getItemAsync(`${key}.${generation}.${index}`)));
  if (values.some((value) => value === null)) return null;
  return values.join('');
}

export async function writeCampaignDraft(userId: string, value: string): Promise<void> {
  if (value.length > MAX_DRAFT_SIZE) throw new Error('This draft is too large for local secure storage. Shorten its story text and try again.');
  const key = `${KEY_PREFIX}.${userId}`;
  const oldManifest = await SecureStore.getItemAsync(`${key}.manifest`);
  let old: { generation?: unknown; count?: unknown } = {};
  try { if (oldManifest) old = JSON.parse(oldManifest) as { generation?: unknown; count?: unknown }; } catch { /* Replace invalid local metadata safely. */ }
  const chunks = Array.from({ length: Math.max(1, Math.ceil(value.length / CHUNK_SIZE)) }, (_, index) => value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE));
  const generation = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await Promise.all(chunks.map((chunk, index) => SecureStore.setItemAsync(`${key}.${generation}.${index}`, chunk)));
  await SecureStore.setItemAsync(`${key}.manifest`, JSON.stringify({ generation, count: chunks.length }));
  const oldGeneration = typeof old.generation === 'string' && /^[0-9a-z-]+$/.test(old.generation) ? old.generation : '';
  const oldCount = Math.max(0, Math.min(Number.isInteger(Number(old.count)) ? Number(old.count) : 0, Math.ceil(MAX_DRAFT_SIZE / CHUNK_SIZE)));
  if (oldGeneration) await Promise.all(Array.from({ length: oldCount }, (_, index) => SecureStore.deleteItemAsync(`${key}.${oldGeneration}.${index}`)));
}

export async function clearCampaignDraft(userId: string): Promise<void> {
  const key = `${KEY_PREFIX}.${userId}`;
  const manifest = await SecureStore.getItemAsync(`${key}.manifest`);
  let parsed: { generation?: unknown; count?: unknown } = {};
  try { if (manifest) parsed = JSON.parse(manifest) as { generation?: unknown; count?: unknown }; } catch { /* Remove the manifest even if corrupted. */ }
  const generation = typeof parsed.generation === 'string' && /^[0-9a-z-]+$/.test(parsed.generation) ? parsed.generation : '';
  const count = Math.max(0, Math.min(Number.isInteger(Number(parsed.count)) ? Number(parsed.count) : 0, Math.ceil(MAX_DRAFT_SIZE / CHUNK_SIZE)));
  await Promise.all([SecureStore.deleteItemAsync(`${key}.manifest`), ...(generation ? Array.from({ length: count }, (_, index) => SecureStore.deleteItemAsync(`${key}.${generation}.${index}`)) : [])]);
}

export async function writeCampaignSubmission(userId: string, campaign: LocalCampaignDraft): Promise<void> {
  const indexKey = `${userId}.submitted-index`;
  const current = await readCampaignSubmissions(userId);
  const entry: LocalCampaignIndexEntry = {
    id: campaign.id,
    title: campaign.title,
    category: campaign.category,
    creatorName: campaign.creatorName,
    submittedAt: new Date().toISOString(),
  };
  await writeCampaignDraft(`${userId}.submitted.${campaign.id}`, JSON.stringify(campaign));
  await writeCampaignDraft(indexKey, JSON.stringify([entry, ...current.filter((item) => item.id !== campaign.id)].slice(0, 25)));
}

export async function readCampaignSubmission(userId: string, campaignId: string): Promise<LocalCampaignDraft | null> {
  const archived = await readCampaignDraft(`${userId}.submitted.${campaignId}`);
  const active = archived ?? await readCampaignDraft(userId);
  if (!active || active.length > MAX_DRAFT_SIZE) return null;
  try {
    const campaign = normalizeLocalCampaignDraft(JSON.parse(active));
    return campaign?.id === campaignId && campaign.localStatus === 'submitted_locally' ? campaign : null;
  } catch { return null; }
}

export async function readLocalCampaign(userId: string, campaignId: string): Promise<LocalCampaignDraft | null> {
  const archived = await readCampaignDraft(`${userId}.submitted.${campaignId}`);
  const active = archived ?? await readCampaignDraft(userId);
  if (!active || active.length > MAX_DRAFT_SIZE) return null;
  try {
    const campaign = normalizeLocalCampaignDraft(JSON.parse(active));
    return campaign?.id === campaignId ? campaign : null;
  } catch { return null; }
}

export async function readCampaignSubmissions(userId: string): Promise<LocalCampaignIndexEntry[]> {
  const raw = await readCampaignDraft(`${userId}.submitted-index`);
  if (raw && raw.length > MAX_DRAFT_SIZE) return [];
  try {
    const values: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(values)) return [];
    const entries = values.filter((item): item is LocalCampaignIndexEntry => Boolean(
      item && typeof item === 'object'
      && typeof (item as LocalCampaignIndexEntry).id === 'string'
      && typeof (item as LocalCampaignIndexEntry).title === 'string'
      && typeof (item as LocalCampaignIndexEntry).submittedAt === 'string'
    ));
    const active = await readCampaignDraft(userId);
    if (active && active.length <= MAX_DRAFT_SIZE) {
      try {
        const campaign = normalizeLocalCampaignDraft(JSON.parse(active));
        if (campaign?.localStatus === 'submitted_locally' && !entries.some((item) => item.id === campaign.id || (
          item.title === campaign.title && item.category === campaign.category && item.creatorName === campaign.creatorName
        ))) {
          entries.unshift({ id: campaign.id, title: campaign.title, category: campaign.category, creatorName: campaign.creatorName, submittedAt: '' });
        }
      } catch { /* Keep the usable submission index if the active draft is malformed. */ }
    }
    return entries.slice(0, 25);
  } catch {
    return [];
  }
}

/** Native SecureStore does not support safe key enumeration; the browser diagnostic is implemented in the web adapter. */
export function getCampaignStorageDiagnostics(ownerIds: string[]) {
  return { available: false, campaignStorageKeyCount: 0, otherOwnerKeyCount: 0, namespaces: ownerIds.map((ownerId) => ({
    ownerId, activeRecordPresent: false, activeSubmitted: false, submissionIndexPresent: false,
    submittedRecordCount: 0, indexedSubmissionCount: 0, archiveCount: 0, activityRecordPresent: false, storedActivityEventCount: 0,
    activeKey: '', indexKey: '', activityKey: '',
  })) };
}
