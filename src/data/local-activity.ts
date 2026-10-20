import { readCampaignDraft, readCampaignSubmission, readCampaignSubmissions, writeCampaignDraft } from '@/data/campaign-draft-storage';
import { mergeAccountEvents as mergeEvents, recoverArchivedContributionEvents, recoverArchivedSubmissionEvents } from '@/data/local-activity-core';
import { normalizeLocalCampaignDraft, type LocalCampaignDraft } from '@/types/local-campaign';

// Lazy import to avoid circular dependency and test environment issues
let catalogCampaignsCache: Record<string, string> | null = null;

function getCatalogCampaigns(): Record<string, string> {
  if (catalogCampaignsCache) return catalogCampaignsCache;
  try {
    const { discoveryCampaigns } = require('@/data/campaigns');
    catalogCampaignsCache = Object.fromEntries(
      discoveryCampaigns.map((campaign: { id: string; title: string }) => [campaign.id, campaign.title])
    );
  } catch {
    // Fallback for test environment or if campaigns module is unavailable
    catalogCampaignsCache = {
      'pages-for-all-library': 'Every Child Deserves a Library',
      'green-bengaluru-lakes': "Our Lakes Aren't Dumping Grounds",
      'neighbourhood-arts-collective': 'Let Our Neighbourhood Tell Its Story',
      'better-streets-collective': 'The Streets We Deserve',
      'community-health-connect': 'Health Information Should Reach Everyone',
      'community-science-watch': 'Community Science, Shared Discoveries',
      'people-first-city-budget': 'A Clearer View of the City Budget',
      'neighbourhood-makers-market': 'A Market for Neighbourhood Makers',
      'neighbourhood-heat-safety': 'Cooler Routes Through Our Neighbourhood',
      'stories-across-generations': 'Stories That Bring Generations Together',
      'ananya-lake-shared-responsibility': 'Our Lakes, Our Shared Responsibility',
      'rohan-safer-streets-everyone': 'Safer Streets Begin With Everyone',
      'amara-clean-water-community': 'Clean Water, Stronger Communities',
      'lucas-room-to-move': 'Room to Move: Streets for Everyone',
      'yuki-art-in-every-neighbourhood': 'Art Belongs in Every Neighbourhood',
    };
  }
  return catalogCampaignsCache;
}

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

export const CATALOG_CAMPAIGNS: Record<string, string> = getCatalogCampaigns();

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
    try {
      const contributionsByCampaign: { campaignId: string; campaignTitle?: string; records: unknown[] }[] = [];
      for (const [campaignId, title] of Object.entries(CATALOG_CAMPAIGNS)) {
        const raw = await readCampaignDraft(`device.demo-contributions.v2.${campaignId}`);
        if (raw) {
          try {
            const records: unknown = JSON.parse(raw);
            if (Array.isArray(records)) {
              contributionsByCampaign.push({ campaignId, campaignTitle: title, records });
            }
          } catch { /* Ignore malformed raw records */ }
        }
      }
      recovered = recoverArchivedContributionEvents(recovered, contributionsByCampaign, new Date().toISOString());
    } catch {
      // Existing event records remain readable if demo ledger is unavailable.
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
    const key = event.eventType === 'campaign.submitted'
      ? `${event.eventType}:${event.campaignId}`
      : event.eventType === 'contribution.simulated' && typeof event.metadata?.contributionId === 'string'
        ? `${event.eventType}:${event.metadata.contributionId}`
        : `${event.id}`;
    const existing = unique.get(key);
    if (!existing || event.metadata.recoveredFromAnonymousDevice !== true) unique.set(key, event);
  }
  return [...unique.values()].slice(0, MAX_EVENTS);
}

/** Read only events stored in this account's namespace, without device-wide recovery. */
export async function readOwnedLocalActivityEvents(userId: string): Promise<LocalActivityEvent[]> {
  if (!userId || userId === 'device-draft') return [];
  return readStoredEvents(userId);
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

export async function recordLocalContribution(
  userId: string,
  contribution: {
    id: string;
    campaignId: string;
    amountMinor: number;
    currency?: string;
    createdAt?: string;
    idempotencyKey?: string;
    displayFirstName?: string | null;
    showFirstName?: boolean;
  },
  campaignTitle: string,
): Promise<void> {
  const ownerId = userId || 'device-draft';
  const current = await readStoredEvents(ownerId);
  const id = `local:contribution:${contribution.id}`;
  if (current.some((item) => item.id === id || item.metadata?.contributionId === contribution.id)) {
    notifyActivityChanged();
    return;
  }
  const event: LocalActivityEvent = {
    id,
    eventType: 'contribution.simulated',
    campaignId: contribution.campaignId,
    campaignTitle,
    createdAt: contribution.createdAt || new Date().toISOString(),
    metadata: {
      contributionId: contribution.id,
      amountMinor: contribution.amountMinor,
      currency: contribution.currency || 'USD',
      displayFirstName: contribution.displayFirstName,
      showFirstName: contribution.showFirstName,
      idempotencyKey: contribution.idempotencyKey,
    },
  };
  const next = [event, ...current].slice(0, MAX_EVENTS);
  await writeCampaignDraft(storageKey(ownerId), JSON.stringify(next));
  notifyActivityChanged();
}
