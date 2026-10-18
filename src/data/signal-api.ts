import { normalizeLocalCampaignDraft, type LocalCampaignDraft } from '@/types/local-campaign';

const API_BASE_URL = process.env.EXPO_PUBLIC_SIGNAL_API_URL?.replace(/\/$/, '');

export function isSignalApiConfigured(): boolean {
  return Boolean(API_BASE_URL);
}

export type SignalActivityEvent = {
  id: string;
  eventType: string;
  campaignId: string | null;
  campaignTitle: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export class SignalApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly diagnostic: string | null;
  readonly retryAfterMs: number | null;

  constructor(status: number, code: string | null, message: string, diagnostic: string | null = null, retryAfterMs: number | null = null) {
    super(message);
    this.name = 'SignalApiError';
    this.status = status;
    this.code = code;
    this.diagnostic = diagnostic;
    this.retryAfterMs = retryAfterMs;
  }
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? Math.max(0, timestamp - Date.now()) : null;
}

function apiCampaignToLocal(value: unknown): LocalCampaignDraft | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== 'string' || !item.data || typeof item.data !== 'object') return null;
  const data = item.data as Record<string, unknown>;
  const asMoney = (minor: unknown) => typeof minor === 'number' && Number.isSafeInteger(minor) && minor >= 0
    ? (minor / 100).toFixed(2).replace(/\.00$/, '')
    : '';
  return normalizeLocalCampaignDraft({
    ...data,
    id: item.id,
    version: 1,
    currentStep: 5,
    localStatus: item.status === 'draft' ? 'draft' : 'submitted_locally',
    apiSubmissionStatus: item.status === 'draft' ? undefined : 'submitted',
    fundingGoal: asMoney(data.fundingGoalMinor),
    instagramBudget: asMoney(data.instagramBudgetMinor),
    facebookBudget: asMoney(data.facebookBudgetMinor),
    minimumAge: typeof data.minimumAge === 'number' ? String(data.minimumAge) : '',
    maximumAge: typeof data.maximumAge === 'number' ? String(data.maximumAge) : '',
    durationDays: typeof data.durationDays === 'number' ? String(data.durationDays) : '',
  });
}

async function getApiCampaignResponse(path: string, accessToken: string): Promise<{ error?: { message?: unknown }; campaign?: unknown; campaigns?: unknown }> {
  if (!API_BASE_URL) throw new Error('SIGNAL API URL is not configured.');
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  } catch {
    throw new Error('The SIGNAL API could not be reached.');
  }
  const result = await response.json().catch(() => ({})) as { error?: { message?: unknown }; campaign?: unknown; campaigns?: unknown };
  if (!response.ok) throw new Error(typeof result.error?.message === 'string' ? result.error.message : 'The campaign could not be loaded from the SIGNAL API.');
  return result;
}

export async function getCampaignFromApi(id: string, accessToken: string): Promise<LocalCampaignDraft | null> {
  const result = await getApiCampaignResponse(`/api/campaigns/${encodeURIComponent(id)}`, accessToken);
  return apiCampaignToLocal(result.campaign);
}

export async function listSubmittedCampaignsFromApi(accessToken: string): Promise<Array<{
  id: string; title: string; category: string; creatorName: string; submittedAt: string; apiSubmissionStatus: 'submitted';
}>> {
  const result = await getApiCampaignResponse('/api/campaigns?mine=true', accessToken);
  if (!Array.isArray(result.campaigns)) throw new Error('The SIGNAL API returned an invalid campaign list.');
  return result.campaigns.flatMap((value) => {
    const item = value as Record<string, unknown>;
    const campaign = apiCampaignToLocal(item);
    if (!campaign || item.status === 'draft') return [];
    return [{ id: campaign.id, title: campaign.title, category: campaign.category, creatorName: campaign.creatorName, submittedAt: typeof item.submittedAt === 'string' ? item.submittedAt : '', apiSubmissionStatus: 'submitted' as const }];
  });
}

export async function getSignalActivity(accessToken: string): Promise<SignalActivityEvent[]> {
  if (!API_BASE_URL) throw new Error('SIGNAL API URL is not configured.');
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/activity`, { headers: { Authorization: `Bearer ${accessToken}` } });
  } catch (error) {
    const detail = error instanceof Error && error.message ? `: ${error.message}` : '';
    throw new Error(`Network request to the SIGNAL API failed${detail}`);
  }
  const result = await response.json().catch(() => null) as { error?: { code?: unknown; message?: unknown; diagnostic?: unknown }; events?: unknown } | null;
  if (!response.ok) {
    const code = typeof result?.error?.code === 'string' ? result.error.code : null;
    const providerMessage = typeof result?.error?.message === 'string' ? result.error.message : '';
    const diagnostic = typeof result?.error?.diagnostic === 'string' ? result.error.diagnostic : null;
    const detail = [code, providerMessage, diagnostic ? `diagnostic: ${diagnostic}` : null].filter(Boolean).join(': ');
    throw new SignalApiError(
      response.status,
      code,
      `SIGNAL API returned HTTP ${response.status}${detail ? ` ${detail}` : ''}`,
      diagnostic,
      parseRetryAfter(response.headers?.get('Retry-After') ?? null),
    );
  }
  if (!result || !Array.isArray(result.events)) {
    throw new Error(`SIGNAL API returned an invalid Activity response (HTTP ${response.status}).`);
  }
  return result.events.flatMap((value): SignalActivityEvent[] => {
    if (!value || typeof value !== 'object') return [];
    const event = value as Record<string, unknown>;
    if (typeof event.id !== 'string' || typeof event.eventType !== 'string' || typeof event.createdAt !== 'string') return [];
    return [{
      id: event.id,
      eventType: event.eventType,
      campaignId: typeof event.campaignId === 'string' ? event.campaignId : null,
      campaignTitle: typeof event.campaignTitle === 'string' ? event.campaignTitle : null,
      metadata: event.metadata && typeof event.metadata === 'object' ? event.metadata as Record<string, unknown> : {},
      createdAt: event.createdAt,
    }];
  });
}

/** Retry Activity once with a freshly rotated token when Supabase rejects a stale access token. */
export async function getSignalActivityWithRefresh(
  accessToken: string,
  refreshAccessToken: (rejectedAccessToken: string) => Promise<string | null>,
): Promise<SignalActivityEvent[]> {
  try {
    return await getSignalActivity(accessToken);
  } catch (error) {
    if (!(error instanceof SignalApiError) || error.status !== 401) throw error;
    const refreshedToken = await refreshAccessToken(accessToken);
    if (!refreshedToken) throw error;
    return getSignalActivity(refreshedToken);
  }
}

async function apiRequest<T>(path: string, accessToken: string, method: 'PUT' | 'POST', body: unknown): Promise<T> {
  if (!API_BASE_URL) throw new Error('SIGNAL API URL is not configured.');
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('The SIGNAL API could not be reached. Your device-local draft is still saved.');
  }
  const result = await response.json().catch(() => ({})) as { error?: { message?: unknown }; campaign?: unknown; draft?: unknown };
  if (!response.ok) {
    const message = typeof result.error?.message === 'string' ? result.error.message : 'The SIGNAL API could not save this draft.';
    throw new Error(`Device-local draft is saved. Backend sync failed: ${message}`);
  }
  return result as T;
}

export async function listCampaignDraftsFromApi(accessToken: string): Promise<LocalCampaignDraft[]> {
  if (!API_BASE_URL) throw new Error('SIGNAL API URL is not configured.');
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/drafts`, { headers: { Authorization: `Bearer ${accessToken}` } });
  } catch {
    throw new Error('The SIGNAL API could not be reached.');
  }
  const result = await response.json().catch(() => ({})) as { drafts?: Array<{ id?: unknown; data?: unknown; updatedAt?: unknown }> };
  if (!response.ok || !Array.isArray(result.drafts)) throw new Error('Saved backend drafts could not be loaded.');
  return [...result.drafts].sort((left, right) => String(right.updatedAt ?? '').localeCompare(String(left.updatedAt ?? ''))).flatMap((item) => {
    if (typeof item.id !== 'string' || !item.data || typeof item.data !== 'object') return [];
    const data = item.data as Record<string, unknown>;
    const asMoney = (minor: unknown) => typeof minor === 'number' && Number.isSafeInteger(minor) && minor >= 0
      ? (minor / 100).toFixed(2).replace(/\.00$/, '')
      : '';
    const draft = normalizeLocalCampaignDraft({
      ...data,
      id: item.id,
      version: 1,
      currentStep: 1,
      localStatus: 'draft',
      fundingGoal: asMoney(data.fundingGoalMinor),
      instagramBudget: asMoney(data.instagramBudgetMinor),
      facebookBudget: asMoney(data.facebookBudgetMinor),
      minimumAge: typeof data.minimumAge === 'number' ? String(data.minimumAge) : '',
      maximumAge: typeof data.maximumAge === 'number' ? String(data.maximumAge) : '',
      durationDays: typeof data.durationDays === 'number' ? String(data.durationDays) : '',
    });
    return draft ? [draft] : [];
  });
}

export function saveCampaignDraftToApi(draft: LocalCampaignDraft, accessToken: string): Promise<{ draft: unknown }> {
  return apiRequest(`/api/drafts/${encodeURIComponent(draft.id)}`, accessToken, 'PUT', draft);
}

export function submitCampaignToApi(draftId: string, accessToken: string): Promise<{ campaign: unknown; message: string }> {
  return apiRequest(`/api/campaigns/${encodeURIComponent(draftId)}/submit`, accessToken, 'POST', { policyAccepted: true });
}

/** Reconcile an interrupted/local submission before retrying so an already accepted campaign is never submitted twice. */
export async function syncCampaignSubmissionToApi(draft: LocalCampaignDraft, accessToken: string): Promise<void> {
  if (!API_BASE_URL) throw new Error('SIGNAL API URL is not configured.');
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/campaigns/${encodeURIComponent(draft.id)}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    throw new Error('The SIGNAL API could not be reached. Your device-local submission is preserved.');
  }

  if (response.ok) {
    const result = await response.json().catch(() => ({})) as { campaign?: { status?: unknown } };
    if (result.campaign && result.campaign.status !== 'draft') return;
  } else if (response.status !== 404) {
    throw new Error('The existing backend campaign could not be checked. Your device-local submission is preserved.');
  }

  const apiDraft = { ...draft, currentStep: 5, localStatus: 'draft' as const };
  await saveCampaignDraftToApi(apiDraft, accessToken);
  await submitCampaignToApi(draft.id, accessToken);
}
