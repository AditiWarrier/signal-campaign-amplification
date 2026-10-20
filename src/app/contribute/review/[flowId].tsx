import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { CampaignIdentity, FlowButton, FlowCard, FlowLink, FlowPage, InfoNote, MoneyRow, formatContributionMoney } from '@/components/contributions/flow-ui';
import { loadContributionCampaign, type ContributionCampaign } from '@/data/contribution-campaign';
import { readCampaignDemoContributions } from '@/data/demo-contributions';
import { readContributionFlow, updateContributionFlow, writeContributionFlow, type ContributionFlow } from '@/data/contribution-flow';
import { campaignFundingMinorForContribution } from '@/data/demo-reach';
import { listDemoContributionsFromApi } from '@/data/signal-api';
import { calculateFundingProgress } from '@/data/funding';
import { Palette as C } from '@/constants/theme';

export default function ContributionReviewScreen() {
  const { flowId } = useLocalSearchParams<{ flowId: string }>();
  const { user, session } = useAuth();
  const [flow, setFlow] = useState<ContributionFlow | null>(null);
  const [campaign, setCampaign] = useState<ContributionCampaign | null>(null);
  const [raisedMinor, setRaisedMinor] = useState(0);
  const [progressError, setProgressError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const saved = await readContributionFlow(flowId ?? '');
        if (!saved) { if (active) setError('Contribution review details are missing or expired. Return to the campaign to start again.'); return; }
        const target = await loadContributionCampaign(saved.campaignRouteId, { userId: user?.id, accessToken: session?.access_token });
        if (!target) { if (active) setError('The campaign linked to this review could not be found.'); return; }
        if (active) { setFlow(saved); setCampaign(target); }
        try {
          const records = target.origin === 'api'
            ? (session?.access_token ? await listDemoContributionsFromApi(target.id, session.access_token) : [])
            : target.origin === 'catalog' ? await readCampaignDemoContributions(target.id) : [];
          const total = records.reduce((sum, item) => Math.min(Number.MAX_SAFE_INTEGER, sum + (target.currency === 'INR' ? campaignFundingMinorForContribution(item) : item.amountMinor)), 0);
          if (active) setRaisedMinor(target.seededRaisedMinor + total);
        } catch (caught) {
          if (active) setProgressError(caught instanceof Error ? caught.message : 'Current campaign progress is unavailable.');
        }
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'Contribution review could not be loaded.');
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [flowId, session?.access_token, user?.id]);

  async function continueToCheckout() {
    if (!flow) return;
    setBusy(true); setError('');
    try {
      await writeContributionFlow(updateContributionFlow(flow, { status: 'checkout', error: undefined }));
      router.push({ pathname: '/contribute/checkout/[flowId]', params: { flowId: flow.id } } as never);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Checkout could not be opened.'); }
    finally { setBusy(false); }
  }

  if (loading) return <FlowPage title="Contribution review" subtitle="Loading your review…" />;
  if (!flow || !campaign) return <FlowPage title="Review unavailable" subtitle={error}>
    <FlowButton title="Return to Explore" onPress={() => router.replace('/explore' as never)} />
  </FlowPage>;

  const funding = calculateFundingProgress(campaign.goalMinor, raisedMinor);
  const remaining = funding.remainingMinor;
  const currency = campaign.currency;
  const contributionInCampaignCurrency = flow.campaignAmountMinor;

  return <FlowPage title="Review your contribution" subtitle="Confirm the amount and campaign before entering simulated checkout.">
    <CampaignIdentity campaign={campaign} />
    <FlowCard title="Contribution summary">
      <MoneyRow label="Contribution" value={formatContributionMoney(flow.amountMinor)} />
      <MoneyRow label="Platform / transaction fee" value={`${formatContributionMoney(flow.feeMinor)} · no fee configured`} />
      <View style={styles.rule} />
      <MoneyRow label="Total payable" value={formatContributionMoney(flow.totalMinor)} strong />
      {flow.showFirstName && flow.firstName ? <MoneyRow label="Recent backer name" value={flow.firstName} /> : null}
      <InfoNote>All amounts and checkout results in this flow are simulated. No real payment method is used and no money will be charged.</InfoNote>
    </FlowCard>

    <FlowCard title="Campaign funding progress">
      <MoneyRow label="Funding goal" value={formatContributionMoney(campaign.goalMinor, currency)} />
      <MoneyRow label="Current demo progress" value={formatContributionMoney(raisedMinor, currency)} />
      <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityLabel="Current campaign funding progress" accessibilityValue={funding.percentage === null ? undefined : { min: 0, max: 100, now: Math.round(funding.barPercentage) }}>
        <View style={[styles.progressFill, { width: `${funding.barPercentage}%` }]} />
      </View>
      <MoneyRow label="Funding progress" value={funding.percentage === null ? 'Unavailable' : `${funding.percentage.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`} />
      <MoneyRow label="Remaining to goal" value={remaining === null ? 'Unavailable' : formatContributionMoney(remaining, currency)} />
      <MoneyRow label="This contribution in campaign currency" value={formatContributionMoney(contributionInCampaignCurrency, currency)} />
      {campaign.currency === 'INR' ? <Text style={styles.hint}>The INR amount uses the fixed demo assumption $1 = ₹80. It is not a current exchange rate.</Text> : null}
      {progressError ? <InfoNote tone="error">Current contribution records could not be refreshed: {progressError}</InfoNote> : null}
    </FlowCard>

    <FlowCard title="Terms and refunds">
      <Text style={styles.body}>Contributions are intended to support campaign amplification and message distribution, not direct charitable support to the cause.</Text>
      <Text style={styles.body}>No funds move in this demo. Because no real payment is taken, there is no payment or refund to process. The campaign’s existing detail page has its full use-of-funds and refund information.</Text>
      <Text style={styles.body}>Estimated potential reach: {flow.estimatedPotentialReach.toLocaleString('en-US')} possible views. This is an illustrative model, not measured delivery.</Text>
    </FlowCard>

    {error ? <InfoNote tone="error">{error}</InfoNote> : null}
    <FlowButton title="Continue to secure checkout" onPress={() => { void continueToCheckout(); }} disabled={busy} accessibilityHint="Opens the clearly labelled simulated checkout. No payment is made." />
    <FlowLink title="Edit contribution amount" onPress={() => router.back()} />
    <FlowLink title="Return to campaign details" onPress={() => router.replace({ pathname: '/campaign/[id]', params: { id: campaign.routeId } } as never)} />
  </FlowPage>;
}

const styles = {
  rule: { height: 1, backgroundColor: C.line, marginVertical: 4 },
  hint: { color: C.muted, fontSize: 11, lineHeight: 17 },
  body: { color: C.muted, fontSize: 13, lineHeight: 20 },
  progressTrack: { height: 9, borderRadius: 5, backgroundColor: C.line, overflow: 'hidden' as const, marginVertical: 3 },
  progressFill: { height: '100%' as const, borderRadius: 5, backgroundColor: C.green },
};
