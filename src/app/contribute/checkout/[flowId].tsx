import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { useAuth } from '@/auth/auth-context';
import { CampaignIdentity, FlowButton, FlowCard, FlowLink, FlowPage, InfoNote, MoneyRow, formatContributionMoney } from '@/components/contributions/flow-ui';
import { loadContributionCampaign, type ContributionCampaign } from '@/data/contribution-campaign';
import { readContributionFlow, updateContributionFlow, writeContributionFlow, type ContributionFlow } from '@/data/contribution-flow';

export default function SimulatedCheckoutScreen() {
  const { flowId } = useLocalSearchParams<{ flowId: string }>();
  const { user, session } = useAuth();
  const [flow, setFlow] = useState<ContributionFlow | null>(null);
  const [campaign, setCampaign] = useState<ContributionCampaign | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const saved = await readContributionFlow(flowId ?? '');
        if (!saved) { if (active) setError('Checkout session is missing. Return to the campaign and start again.'); return; }
        if (saved.status === 'success' || saved.status === 'rejected' || saved.status === 'failed' || saved.status === 'cancelled') {
          router.replace({ pathname: '/contribute/result/[flowId]', params: { flowId: saved.id } } as never);
          return;
        }
        const target = await loadContributionCampaign(saved.campaignRouteId, { userId: user?.id, accessToken: session?.access_token });
        if (active) { setFlow(saved); setCampaign(target); if (!target) setError('The selected campaign is no longer available.'); }
      } catch (caught) { if (active) setError(caught instanceof Error ? caught.message : 'The simulated checkout could not be loaded.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [flowId, session?.access_token, user?.id]);

  async function confirmContribution() {
    if (!flow || busy) return;
    setBusy(true); setError('');
    try {
      await writeContributionFlow(updateContributionFlow(flow, { status: 'checkout', outcome: 'success', error: undefined }));
      router.push({ pathname: '/contribute/processing/[flowId]', params: { flowId: flow.id } } as never);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The checkout result could not be recorded.'); }
    finally { setBusy(false); }
  }

  if (loading) return <FlowPage title="Simulated Checkout — Demo Only" subtitle="Preparing the demo checkout…" />;
  if (!flow || !campaign) return <FlowPage title="Checkout unavailable" subtitle={error}>
    <FlowButton title="Return to campaign" onPress={() => router.replace('/explore' as never)} />
  </FlowPage>;

  return <FlowPage title="Simulated Checkout — Demo Only" subtitle="Confirm your demo contribution. This page does not collect card details, bank credentials, or real payment information.">
    <CampaignIdentity campaign={campaign} />
    <FlowCard title="Your demo checkout">
      <MoneyRow label="Campaign" value={campaign.title} />
      <MoneyRow label="Contribution" value={formatContributionMoney(flow.amountMinor)} />
      <MoneyRow label="Fees" value={`${formatContributionMoney(flow.feeMinor)} · none configured`} />
      <MoneyRow label="Total" value={formatContributionMoney(flow.totalMinor)} strong />
      <InfoNote>No real money will be charged. Confirming records a successful demo contribution only; no payment provider is contacted.</InfoNote>
    </FlowCard>
    <FlowButton title="Confirm Contribution" onPress={() => { void confirmContribution(); }} disabled={busy} />
    {error ? <InfoNote tone="error">{error}</InfoNote> : null}
    <FlowLink title="Back to contribution review" onPress={() => router.back()} />
    <FlowLink title="Return to campaign" onPress={() => router.replace({ pathname: '/campaign/[id]', params: { id: campaign.routeId } } as never)} />
  </FlowPage>;
}
