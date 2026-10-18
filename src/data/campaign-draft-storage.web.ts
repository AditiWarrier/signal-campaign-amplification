import { getBrowserStorage, inspectCampaignStorage, readCampaignDraft as readDraft, readCampaignSubmission as readSubmission, readCampaignSubmissions as readSubmissions, writeCampaignDraft as writeDraft, writeCampaignSubmission as writeSubmission } from '@/data/campaign-draft-storage-web-core';
import { normalizeLocalCampaignDraft, type LocalCampaignDraft, type LocalCampaignIndexEntry } from '@/types/local-campaign';

export async function readCampaignDraft(userId: string): Promise<string | null> {
  return readDraft(getBrowserStorage(), userId);
}

export async function writeCampaignDraft(userId: string, value: string): Promise<void> {
  try { writeDraft(getBrowserStorage(), userId, value); }
  catch { throw new Error('This browser could not save the draft locally. Check available storage and try again.'); }
}

export async function clearCampaignDraft(userId: string): Promise<void> {
  try { getBrowserStorage()?.removeItem(`signal.campaign.draft.v1.${userId}`); } catch { /* Unavailable browser storage is already clear from this screen's perspective. */ }
}

export async function writeCampaignSubmission(userId: string, campaign: LocalCampaignDraft): Promise<void> {
  try { await writeSubmission(getBrowserStorage(), userId, campaign); }
  catch { throw new Error('This browser could not save the campaign submission locally. Check available storage and try again.'); }
}

export async function readCampaignSubmission(userId: string, campaignId: string): Promise<LocalCampaignDraft | null> {
  const campaign = normalizeLocalCampaignDraft(readSubmission(getBrowserStorage(), userId, campaignId));
  return campaign?.id === campaignId ? campaign : null;
}

export async function readLocalCampaign(userId: string, campaignId: string): Promise<LocalCampaignDraft | null> {
  const raw = await readCampaignDraft(`${userId}.submitted.${campaignId}`) ?? await readCampaignDraft(userId);
  if (!raw || raw.length > 48_000) return null;
  try {
    const campaign = normalizeLocalCampaignDraft(JSON.parse(raw));
    return campaign?.id === campaignId ? campaign : null;
  } catch { return null; }
}

export async function readCampaignSubmissions(userId: string): Promise<LocalCampaignIndexEntry[]> {
  return readSubmissions(getBrowserStorage(), userId) as LocalCampaignIndexEntry[];
}

export function getCampaignStorageDiagnostics(ownerIds: string[]) {
  return inspectCampaignStorage(getBrowserStorage(), ownerIds);
}
