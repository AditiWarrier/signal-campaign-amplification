import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Share, Text } from 'react-native';

import { CampaignIdentity, FlowButton, FlowCard, FlowPage, InfoNote, MoneyRow, formatContributionMoney } from '@/components/contributions/flow-ui';
import { loadContributionCampaign, type ContributionCampaign } from '@/data/contribution-campaign';
import { readContributionFlow, type ContributionFlow } from '@/data/contribution-flow';
import { Palette as C } from '@/constants/theme';
import { useAuth } from '@/auth/auth-context';

export default function DemoReceiptScreen() {
  const { flowId } = useLocalSearchParams<{ flowId: string }>();
  const { user, session } = useAuth();
  const [flow, setFlow] = useState<ContributionFlow | null>(null);
  const [campaign, setCampaign] = useState<ContributionCampaign | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const saved = await readContributionFlow(flowId ?? '');
        if (!saved || saved.status !== 'success' || !saved.contribution) {
          if (active) setError('A receipt is available only after a successful simulated contribution. No payment receipt was created.');
          return;
        }
        const target = await loadContributionCampaign(saved.campaignRouteId, { userId: user?.id, accessToken: session?.access_token });
        if (active) { setFlow(saved); setCampaign(target); }
      } catch (caught) { if (active) setError(caught instanceof Error ? caught.message : 'Receipt details could not be loaded.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [flowId, session?.access_token, user?.id]);

  if (loading) return <FlowPage title="Demo receipt" subtitle="Loading the simulated transaction record…" />;
  if (!flow?.contribution || flow.status !== 'success') return <FlowPage title="Receipt unavailable" subtitle={error}>
    <FlowButton title="Return to Explore" onPress={() => router.replace('/explore' as never)} />
  </FlowPage>;

  const contribution = flow.contribution;
  const reference = `SIGNAL-DEMO-${flow.id.slice(-12).toUpperCase()}`;
  const details = [
    'SIGNAL simulated contribution receipt — demo only',
    `Campaign: ${campaign?.title ?? flow.campaignTitle}`,
    `Contribution: ${formatContributionMoney(contribution.amountMinor)}`,
    `Fee: ${formatContributionMoney(contribution.feeMinor ?? 0)}`,
    `Total: ${formatContributionMoney(contribution.totalMinor ?? contribution.amountMinor)}`,
    `Demo reference: ${reference}`,
    `Created: ${contribution.createdAt}`,
    'No real payment was processed and this is not a payment-provider receipt.',
  ].join('\n');

  async function printOrShareReceipt() {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
      return;
    }
    try { await Share.share({ title: 'SIGNAL demo receipt', message: details }); }
    catch { setMessage('The device share sheet could not be opened.'); }
  }

  return <FlowPage title="Demo receipt" subtitle="A local view of the simulated contribution record.">
    {campaign ? <CampaignIdentity campaign={campaign} /> : null}
    <FlowCard title="Transaction details">
      <MoneyRow label="Campaign" value={campaign?.title ?? flow.campaignTitle} />
      <MoneyRow label="Contribution" value={formatContributionMoney(contribution.amountMinor)} />
      <MoneyRow label="Fees" value={`${formatContributionMoney(contribution.feeMinor ?? 0)} · none configured`} />
      <MoneyRow label="Total" value={formatContributionMoney(contribution.totalMinor ?? contribution.amountMinor)} strong />
      <MoneyRow label="Demo reference" value={reference} />
      <MoneyRow label="Record created" value={contribution.createdAt ? new Date(contribution.createdAt).toLocaleString() : 'Unavailable'} />
      {contribution.displayFirstName ? <MoneyRow label="Optional backer display" value={contribution.displayFirstName} /> : null}
    </FlowCard>
    <InfoNote>This is a simulated demo transaction record, not a real payment receipt. No payment provider processed this contribution, and no money was charged.</InfoNote>
    {message ? <Text accessibilityLiveRegion="polite" style={styles.hint}>{message}</Text> : null}
    <FlowButton title={Platform.OS === 'web' ? 'Print or save receipt' : 'Share receipt details'} onPress={() => { void printOrShareReceipt(); }} />
    <FlowButton title="Return to contribution confirmation" secondary onPress={() => router.replace({ pathname: '/contribute/result/[flowId]', params: { flowId: flow.id } } as never)} />
    {error ? <InfoNote tone="error">{error}</InfoNote> : null}
  </FlowPage>;
}

const styles = { hint: { color: C.muted, fontSize: 12, lineHeight: 18 } };
