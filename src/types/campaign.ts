/** Database-facing campaign types. All money amounts use the currency's minor unit. */
export type CampaignStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'completed';

export type CampaignCategory = 'Environment' | 'Education' | 'Community' | 'Human Rights';
export type DistributionChannel = 'instagram' | 'facebook';
export type CreativeKind = 'cover' | 'ad_creative';
export type ContributionStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';
export type JsonObject = { [key: string]: JsonValue };
export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;

export type CampaignRow = {
  id: string;
  creator_id: string;
  title: string;
  category: CampaignCategory | null;
  cause: string;
  summary: string;
  status: CampaignStatus;
  funding_goal_minor: number | null;
  currency: string | null;
  starts_at: string | null;
  ends_at: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_feedback: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignStorySectionRow = {
  id: string;
  campaign_id: string;
  display_order: number;
  heading: string;
  body_markdown: string;
  created_at: string;
  updated_at: string;
};

export type CampaignSourceRow = {
  id: string;
  campaign_id: string;
  display_order: number;
  title: string;
  url: string;
  publisher: string | null;
  created_at: string;
};

export type CampaignCreativeRow = {
  id: string;
  campaign_id: string;
  kind: CreativeKind;
  channel: DistributionChannel | null;
  storage_path: string;
  mime_type: 'image/jpeg' | 'image/png' | 'image/webp';
  byte_size: number;
  width: number;
  height: number;
  alt_text: string;
  caption: string;
  headline: string;
  description: string;
  call_to_action: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
};

export type CampaignLocationRow = {
  id: string;
  campaign_id: string;
  country_code: string;
  region: string | null;
  locality: string | null;
  radius_km: number | null;
  created_at: string;
};

export type CampaignAudienceSettingsRow = {
  campaign_id: string;
  minimum_age: number | null;
  maximum_age: number | null;
  interests: string[];
  audience_notes: string;
  created_at: string;
  updated_at: string;
};

export type CampaignChannelAllocationRow = {
  id: string;
  campaign_id: string;
  channel: DistributionChannel;
  amount_minor: number;
  currency: string;
  created_at: string;
  updated_at: string;
};

export type CampaignReachEstimateRow = {
  id: string;
  campaign_id: string;
  estimated_reach_min: number;
  estimated_reach_max: number;
  basis_budget_minor: number;
  currency: string;
  estimator_version: string;
  assumptions: JsonObject;
  estimate_type: 'illustrative';
  created_at: string;
};

export type CampaignContributionRow = {
  id: string;
  campaign_id: string;
  contributor_id: string | null;
  amount_minor: number;
  currency: string;
  status: ContributionStatus;
  payment_provider: string;
  provider_reference: string | null;
  succeeded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignFundingTotalRow = {
  campaign_id: string;
  total_minor: number;
  currency: string;
  updated_at: string;
};

export type CampaignStatusHistoryRow = {
  id: string;
  campaign_id: string;
  actor_id: string | null;
  from_status: CampaignStatus | null;
  to_status: CampaignStatus;
  note: string | null;
  created_at: string;
};

export type ActivityEventRow = {
  id: string;
  user_id: string;
  campaign_id: string | null;
  event_type: string;
  dedupe_key: string | null;
  metadata: JsonObject;
  created_at: string;
};
