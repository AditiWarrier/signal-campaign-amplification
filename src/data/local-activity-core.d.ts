import type { LocalActivityEvent } from './local-activity';
import type { LocalCampaignDraft, LocalCampaignIndexEntry } from '@/types/local-campaign';

export function recoverArchivedSubmissionEvents(
  currentEvents: LocalActivityEvent[],
  submissions: (LocalCampaignIndexEntry & { anonymousLegacy?: boolean })[],
  campaignsById: Record<string, LocalCampaignDraft | null>,
  recoveredAt: string,
): LocalActivityEvent[];

export function recoverArchivedContributionEvents(
  currentEvents: LocalActivityEvent[],
  contributionsByCampaign: { campaignId: string; campaignTitle?: string; records: unknown[] }[],
  recoveredAt: string,
): LocalActivityEvent[];

export function mergeAccountEvents<T extends { eventType?: string; campaignId?: string; actionId?: string; source: string; id: string }>(localEvents: T[], apiEvents: T[]): T[];

export function filterActivityEvents<T extends { kind?: string; eventType?: string }>(events: T[], category: string): T[];

export function filterActivityNotifications<T extends { category: string }>(notifications: T[], category: string): T[];
