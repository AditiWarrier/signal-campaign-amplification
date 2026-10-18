import { readCampaignDraft, readCampaignSubmission, readCampaignSubmissions, writeCampaignDraft } from '@/data/campaign-draft-storage';
import { mergeAccountEvents as mergeEvents, recoverArchivedSubmissionEvents } from '@/data/local-activity-core';
import { normalizeLocalCampaignDraft, type LocalCampaignDraft } from '@/types/local-campaign';

export type LocalActivityEvent = {
  id: string;
  eventType: string;
  campaignId: string;
  campaignTitle: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};

export { mergeEvents as mergeAccountEvents };

const MAX_EVENTS = 100;

function storageKey(userId: string): string {
  return `${userId}.activity-events.v1`;
}

function notifyActivityChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('signal:activity-updated'));
}

export async function readLocalActivityEvents(userId: string): Promise<LocalActivityEvent[]> {
  const owners = userId === 'device-draft' ? ['device-draft'] : [userId, 'device-draft'];
  const allEvents: LocalActivityEvent[] = [];
  for (const ownerId of owners) {
    const current = await readStoredEvents(ownerId);
    let recovered = current;
    try {
      const indexed = await readCampaignSubmissions(ownerId);
      const activeRaw = await readCampaignDraft(ownerId);
      const active = parseSubmittedCampaign(activeRaw);
      const submissions = [
        ...indexed,
        ...(active && !indexed.some((entry) => entry.id === active.id)
          ? [{ id: active.id, title: active.title, category: active.category, creatorName: active.creatorName, submittedAt: '', anonymousLegacy: ownerId === 'device-draft' && userId !== ownerId }]
          : []),
      ].map((entry) => ({ ...entry, anonymousLegacy: ownerId === 'device-draft' && userId !== ownerId }));
      const ids = [...new Set(submissions.map((item) => item.id))];
      const campaigns = await Promise.all(ids.map((id) => readCampaignSubmission(ownerId, id)));
      const campaignsById = Object.fromEntries(campaigns.filter((campaign) => campaign).map((campaign) => [campaign!.id, campaign!]));
      // An index alone isn't proof of submission; recovery requires a saved submitted campaign.
      recovered = recoverArchivedSubmissionEvents(current, submissions, campaignsById, new Date().toISOString());
    } catch {
      // Existing event records remain readable if legacy campaign storage is unavailable.
    }
    if (recovered.length > current.length) {
      recovered = recovered.slice(0, MAX_EVENTS);
      try { await writeCampaignDraft(storageKey(ownerId), JSON.stringify(recovered)); } catch { /* Keep this view usable when backfill storage is unavailable. */ }
    }
    allEvents.push(...recovered.map((event) => ownerId === 'device-draft' && userId !== ownerId
      ? { ...event, metadata: { ...event.metadata, recoveredFromAnonymousDevice: true } }
      : event));
  }
  const unique = new Map<string, LocalActivityEvent>();
  for (const event of allEvents) {
    const key = event.eventType === 'campaign.submitted' ? `${event.eventType}:${event.campaignId}` : `${event.id}`;
    const existing = unique.get(key);
    if (!existing || event.metadata.recoveredFromAnonymousDevice !== true) unique.set(key, event);
  }
  return [...unique.values()].slice(0, MAX_EVENTS);
}

function parseSubmittedCampaign(value: string | null): LocalCampaignDraft | null {
  if (!value) return null;
  try {
    const campaign = normalizeLocalCampaignDraft(JSON.parse(value));
    return campaign?.localStatus === 'submitted_locally' ? campaign : null;
  } catch { return null; }
}

async function readStoredEvents(userId: string): Promise<LocalActivityEvent[]> {
  const value = await readCampaignDraft(storageKey(userId));
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((event): event is LocalActivityEvent => Boolean(
      event && typeof event === 'object'
      && typeof (event as LocalActivityEvent).id === 'string'
      && typeof (event as LocalActivityEvent).eventType === 'string'
      && typeof (event as LocalActivityEvent).campaignId === 'string'
      && typeof (event as LocalActivityEvent).campaignTitle === 'string'
      && typeof (event as LocalActivityEvent).createdAt === 'string'
      && (event as LocalActivityEvent).metadata && typeof (event as LocalActivityEvent).metadata === 'object'
    )).slice(0, MAX_EVENTS);
  } catch {
    return [];
  }
}

export async function recordLocalCampaignSubmission(userId: string, campaign: LocalCampaignDraft): Promise<void> {
  const current = await readStoredEvents(userId);
  const id = `local:campaign.submitted:${campaign.id}`;
  if (current.some((item) => item.id === id)) { notifyActivityChanged(); return; }
  const event: LocalActivityEvent = {
    id,
    eventType: 'campaign.submitted',
    campaignId: campaign.id,
    campaignTitle: campaign.title,
    createdAt: new Date().toISOString(),
    metadata: {},
  };
  const next = [event, ...current].slice(0, MAX_EVENTS);
  await writeCampaignDraft(storageKey(userId), JSON.stringify(next));
  notifyActivityChanged();
}
