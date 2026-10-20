import type { CampaignCategory, DistributionChannel } from './campaign';

export type LocalStorySection = { id: string; heading: string; body: string };
export type LocalSource = { id: string; title: string; url: string };

/** Private device draft/submission shape; this is not a Supabase row. */
export type LocalCampaignDraft = {
  id: string;
  version: 1;
  currentStep: number;
  localStatus: 'draft' | 'submitted_locally';
  /** Backend state for truthful local-vs-API confirmation copy; absent on legacy saves. */
  apiSubmissionStatus?: 'local_only' | 'submitted' | 'sync_failed';
  /** Backend lifecycle state for API campaigns; absent on local-only drafts. */
  backendStatus?: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'completed' | 'cancelled';
  /** Authenticated owner ID returned by the campaign API, when available. */
  ownerId?: string;
  title: string;
  category: CampaignCategory | '';
  creatorName: string;
  summary: string;
  coverUri: string;
  coverAlt: string;
  storyHeadline: string;
  introduction: string;
  sections: LocalStorySection[];
  sources: LocalSource[];
  audienceActions: string;
  adHeadline: string;
  adDescription: string;
  callToAction: string;
  adImageUri: string;
  adImageAlt: string;
  adImageMetadata: string;
  locations: string[];
  minimumAge: string;
  maximumAge: string;
  interests: string;
  channels: DistributionChannel[];
  durationDays: string;
  instagramBudget: string;
  facebookBudget: string;
  fundingGoal: string;
  policyAccepted: boolean;
};

/** Accepts the original version-1 draft shape and adds a stable ID when older saves lack one. */
export function normalizeLocalCampaignDraft(value: unknown): LocalCampaignDraft | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (record.version !== 1 || typeof record.title !== 'string' || !Array.isArray(record.sections)) return null;

  let id = typeof record.id === 'string' && record.id ? record.id : '';
  if (!id) {
    const source = JSON.stringify(record);
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    id = `legacy-${(hash >>> 0).toString(36)}`;
  }

  return {
    ...record,
    id,
    version: 1,
    currentStep: Number.isInteger(record.currentStep) ? Number(record.currentStep) : 0,
    localStatus: record.localStatus === 'submitted_locally' ? 'submitted_locally' : 'draft',
  } as LocalCampaignDraft;
}

export type LocalCampaignIndexEntry = {
  id: string;
  title: string;
  category: string;
  creatorName: string;
  submittedAt: string;
};

/** A local presentation record only; this never represents a processed payment. */
export type LocalDemoContribution = {
  id: string;
  campaignId: string;
  amountMinor: number;
  currency: 'USD';
  /** Funding amount expressed in the campaign's currency (INR for catalogue campaigns). */
  campaignAmountMinor?: number;
  campaignCurrency?: 'USD' | 'INR';
  /** No fee schedule is configured; retained explicitly for review and receipt consistency. */
  feeMinor?: number;
  totalMinor?: number;
  /** First name is retained only after an explicit display opt-in. */
  displayFirstName?: string | null;
  showFirstName?: boolean;
  status: 'simulated';
  /** Optional for backward compatibility with older device-scoped demo records. */
  contributorId?: string;
  contributorName?: string;
  idempotencyKey: string;
  createdAt: string;
};

// Configurable demo-only assumption; not platform data or an advertising rate.
export const DEMO_REACH_PER_DOLLAR = 45;
