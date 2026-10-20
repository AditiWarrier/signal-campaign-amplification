import { addDemoContribution, readCampaignDemoContributions } from '@/data/demo-contributions';
import { readContributionFlow, updateContributionFlow, writeContributionFlow, type ContributionFlow } from '@/data/contribution-flow';
import { createDemoContributionFromApi, listDemoContributionsFromApi } from '@/data/signal-api';
import { recordLocalContribution } from '@/data/local-activity';
import type { LocalDemoContribution } from '@/types/local-campaign';

const activeProcesses = new Map<string, Promise<ContributionFlow>>();

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function commitContribution(flow: ContributionFlow, accessToken?: string): Promise<LocalDemoContribution> {
  if (flow.origin === 'api') {
    if (!accessToken) throw new Error('Your session expired before the demo contribution could be confirmed. Sign in and retry confirmation.');
    try {
      return await createDemoContributionFromApi(flow.campaignId, flow.amountMinor, flow.id, accessToken, flow.showFirstName ? flow.firstName : undefined);
    } catch (error) {
      // A request can lose its response after the idempotent API commit. Reconcile by key before reporting failure.
      try {
        const records = await listDemoContributionsFromApi(flow.campaignId, accessToken);
        const existing = records.find((item) => item.idempotencyKey === flow.id);
        if (existing) return existing;
      } catch { /* Surface the original write error; the same idempotency key is safe to retry. */ }
      throw error;
    }
  }

  try {
    return await addDemoContribution('device-demo-supporter', flow.campaignId, flow.amountMinor, flow.id, {
      campaignAmountMinor: flow.campaignAmountMinor,
      campaignCurrency: flow.campaignCurrency,
      showFirstName: flow.showFirstName,
      displayFirstName: flow.showFirstName ? flow.firstName : undefined,
    });
  } catch (error) {
    try {
      const records = await readCampaignDemoContributions(flow.campaignId);
      const existing = records.find((item) => item.idempotencyKey === flow.id);
      if (existing) return existing;
    } catch { /* Keep the primary storage failure visible. */ }
    throw error;
  }
}

/** Idempotent demo transaction handler. Failed/rejected/cancelled paths never write a contribution. */
export function processContributionFlow(
  initialFlow: ContributionFlow,
  accessToken?: string,
  userId?: string,
): Promise<ContributionFlow> {
  const existing = activeProcesses.get(initialFlow.id);
  if (existing) return existing;

  const task = (async () => {
    if (!initialFlow.outcome) throw new Error('The checkout outcome is missing. Return to simulated checkout and choose an outcome.');
    await writeContributionFlow(updateContributionFlow(initialFlow, { status: 'processing', error: undefined }));
    await delay(800);

    if (initialFlow.outcome !== 'success') {
      const terminal = updateContributionFlow(initialFlow, { status: initialFlow.outcome, contribution: undefined, error: undefined });
      await writeContributionFlow(terminal);
      return terminal;
    }

    try {
      const contribution = await commitContribution(initialFlow, accessToken);
      const terminal = updateContributionFlow(initialFlow, { status: 'success', contribution, error: undefined });
      await writeContributionFlow(terminal);
      try {
        await recordLocalContribution(userId || 'device-draft', contribution, initialFlow.campaignTitle);
      } catch { /* Preserve flow success even if activity record write fails */ }
      return terminal;
    } catch (error) {
      const failed = updateContributionFlow(initialFlow, {
        status: 'failed',
        contribution: undefined,
        error: error instanceof Error ? error.message : 'The demo contribution could not be confirmed.',
      });
      await writeContributionFlow(failed);
      return failed;
    }
  })().finally(() => {
    if (activeProcesses.get(initialFlow.id) === task) activeProcesses.delete(initialFlow.id);
  });
  activeProcesses.set(initialFlow.id, task);
  return task;
}

/** Recover an interrupted success using the same transaction key; never creates a second ledger entry. */
export async function retryContributionConfirmation(flowId: string, accessToken?: string, userId?: string): Promise<ContributionFlow | null> {
  const flow = await readContributionFlow(flowId);
  if (!flow) return null;
  if (flow.status === 'success' && flow.contribution) {
    try {
      await recordLocalContribution(userId || 'device-draft', flow.contribution, flow.campaignTitle);
    } catch { /* Safe */ }
    return flow;
  }
  const retry = updateContributionFlow(flow, { status: 'checkout', outcome: 'success', error: undefined });
  await writeContributionFlow(retry);
  return processContributionFlow(retry, accessToken, userId);
}
