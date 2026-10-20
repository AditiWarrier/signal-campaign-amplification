import type { ImageSource } from 'expo-image';

import { discoveryCampaigns } from '@/data/campaigns';
import { parseUsdMinor } from '@/data/funding';
import { getCampaignFromApi } from '@/data/signal-api';
import { readLocalCampaign } from '@/data/campaign-draft-storage';
import { type LocalCampaignDraft } from '@/types/local-campaign';

export type ContributionCampaign = {
  routeId: string;
  id: string;
  title: string;
  summary: string;
  cover: number | string | ImageSource | null;
  currency: 'INR' | 'USD';
  goalMinor: number;
  seededRaisedMinor: number;
  origin: 'catalog' | 'api' | 'local';
  status: string;
  backendStatus?: LocalCampaignDraft['backendStatus'];
  ownerId?: string;
  creatorId?: string;
  fundingDeadline?: string;
  platform: string;
};

function validRemoteImage(value: string): string | null {
  return /^https?:\/\//i.test(value) ? value : null;
}

export async function loadContributionCampaign(
  routeId: string,
  options: { userId?: string; accessToken?: string } = {},
): Promise<ContributionCampaign | null> {
  const catalogue = discoveryCampaigns.find((item) => item.id === routeId);
  if (catalogue) {
    return {
      routeId,
      id: catalogue.id,
      title: catalogue.title,
      summary: catalogue.description,
      cover: catalogue.image,
      currency: catalogue.currency,
      goalMinor: parseUsdMinor(catalogue.goal),
      seededRaisedMinor: parseUsdMinor(catalogue.raised),
      origin: 'catalog',
      status: catalogue.status,
      creatorId: catalogue.creatorId,
      fundingDeadline: catalogue.fundingDeadline,
      platform: catalogue.platform,
    };
  }

  if (routeId.startsWith('api-')) {
    if (!options.accessToken) throw new Error('Sign in to contribute to this API campaign.');
    const campaignId = routeId.slice(4);
    const campaign = await getCampaignFromApi(campaignId, options.accessToken);
    if (!campaign) return null;
    return {
      routeId,
      id: campaign.id,
      title: campaign.title,
      summary: campaign.summary,
      cover: validRemoteImage(campaign.coverUri),
      currency: 'USD',
      goalMinor: parseUsdMinor(campaign.fundingGoal),
      seededRaisedMinor: 0,
      origin: 'api',
      status: campaign.backendStatus ?? 'submitted',
      backendStatus: campaign.backendStatus,
      ownerId: campaign.ownerId,
      platform: campaign.channels.map((channel) => channel === 'instagram' ? 'Instagram' : 'Facebook').join(', ') || 'Not specified',
    };
  }

  if (routeId.startsWith('local-')) {
    if (!options.userId) return null;
    const campaign = await readLocalCampaign(options.userId, routeId.slice(6));
    if (!campaign) return null;
    return {
      routeId,
      id: campaign.id,
      title: campaign.title,
      summary: campaign.summary,
      cover: validRemoteImage(campaign.coverUri),
      currency: 'USD',
      goalMinor: parseUsdMinor(campaign.fundingGoal),
      seededRaisedMinor: 0,
      origin: 'local',
      status: campaign.localStatus,
      backendStatus: campaign.backendStatus,
      ownerId: campaign.ownerId,
      platform: campaign.channels.map((channel) => channel === 'instagram' ? 'Instagram' : 'Facebook').join(', ') || 'Not specified',
    };
  }
  return null;
}
