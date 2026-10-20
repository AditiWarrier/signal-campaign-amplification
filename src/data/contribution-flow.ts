import { readCampaignDraft, writeCampaignDraft } from '@/data/campaign-draft-storage';
import { DEMO_REACH_PER_RUPEE, demoUsdToInrMinor } from '@/data/demo-reach';
import { DEMO_REACH_PER_DOLLAR } from '@/types/local-campaign';
import type { LocalDemoContribution } from '@/types/local-campaign';

export type ContributionOutcome = 'success' | 'rejected' | 'failed' | 'cancelled';
export type ContributionFlowStatus = 'review' | 'checkout' | 'processing' | ContributionOutcome;

/** Durable, device-local routing state for the demo flow. It never contains payment credentials. */
export type ContributionFlow = {
  id: string;
  campaignRouteId: string;
  campaignId: string;
  campaignTitle: string;
  origin: 'catalog' | 'api';
  amountMinor: number;
  currency: 'USD';
  feeMinor: 0;
  totalMinor: number;
  campaignAmountMinor: number;
  campaignCurrency: 'USD' | 'INR';
  estimatedPotentialReach: number;
  showFirstName: boolean;
  firstName?: string;
  status: ContributionFlowStatus;
  outcome?: ContributionOutcome;
  contribution?: LocalDemoContribution;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export const MIN_CONTRIBUTION_MINOR = 100;
export const MAX_CONTRIBUTION_MINOR = 100000;
export const CONTRIBUTION_PRESETS_MINOR = [500, 1000, 2500, 5000, 10000] as const;

export function parseUsdAmountInput(value: string): number | null {
  const normalized = value.trim();
  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(normalized)) return null;
  const [whole = '0', fraction = ''] = normalized.split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

export function campaignCurrencyAmountForUsd(amountMinor: number, currency: 'USD' | 'INR'): number {
  return currency === 'INR' ? demoUsdToInrMinor(amountMinor) : amountMinor;
}

export function estimatePotentialReach(amountMinor: number, currency: 'USD' | 'INR'): number {
  if (currency === 'INR') return Math.round((demoUsdToInrMinor(amountMinor) / 100) * DEMO_REACH_PER_RUPEE);
  return Math.round((amountMinor / 100) * DEMO_REACH_PER_DOLLAR);
}

function flowKey(id: string) { return `signal.contribution-flow.v1.${id}`; }

export function createContributionFlowId(): string {
  return `signal-demo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function isContributionFlow(value: unknown): value is ContributionFlow {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ContributionFlow>;
  return typeof item.id === 'string'
    && typeof item.campaignRouteId === 'string'
    && typeof item.campaignId === 'string'
    && typeof item.campaignTitle === 'string' && item.campaignTitle.trim().length > 0 && item.campaignTitle.length <= 120
    && (item.origin === 'catalog' || item.origin === 'api')
    && Number.isSafeInteger(item.amountMinor) && Number(item.amountMinor) >= 100 && Number(item.amountMinor) <= 100000
    && item.currency === 'USD'
    && item.feeMinor === 0
    && item.totalMinor === item.amountMinor
    && Number.isSafeInteger(item.campaignAmountMinor) && Number(item.campaignAmountMinor) > 0
    && (item.campaignCurrency === 'USD' || item.campaignCurrency === 'INR')
    && Number.isSafeInteger(item.estimatedPotentialReach) && Number(item.estimatedPotentialReach) >= 0
    && typeof item.showFirstName === 'boolean'
    && (!item.showFirstName || (typeof item.firstName === 'string' && item.firstName.trim().length > 0 && item.firstName.length <= 40))
    && ['review', 'checkout', 'processing', 'success', 'rejected', 'failed', 'cancelled'].includes(String(item.status))
    && typeof item.createdAt === 'string'
    && typeof item.updatedAt === 'string';
}

export async function readContributionFlow(id: string): Promise<ContributionFlow | null> {
  if (!/^[A-Za-z0-9._:-]{8,120}$/.test(id)) return null;
  const raw = await readCampaignDraft(flowKey(id));
  if (!raw || raw.length > 48_000) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isContributionFlow(parsed) && parsed.id === id ? parsed : null;
  } catch { return null; }
}

export async function writeContributionFlow(flow: ContributionFlow): Promise<void> {
  if (!isContributionFlow(flow)) throw new Error('The contribution flow state is incomplete. Return to the amount form and try again.');
  await writeCampaignDraft(flowKey(flow.id), JSON.stringify(flow));
}

export function updateContributionFlow(flow: ContributionFlow, update: Partial<ContributionFlow>): ContributionFlow {
  return { ...flow, ...update, updatedAt: new Date().toISOString() };
}
