import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { CampaignIdentity, FlowButton, FlowCard, FlowPage, InfoNote, MoneyRow, formatContributionMoney } from '@/components/contributions/flow-ui';
import { loadContributionCampaign, type ContributionCampaign } from '@/data/contribution-campaign';
import { readCampaignDemoContributions } from '@/data/demo-contributions';
import { campaignFundingMinorForContribution, DEMO_REACH_PER_RUPEE } from '@/data/demo-reach';
import { listDemoContributionsFromApi } from '@/data/signal-api';
import { calculateFundingProgress } from '@/data/funding';
import { DEMO_REACH_PER_DOLLAR } from '@/types/local-campaign';
import { Palette as C } from '@/constants/theme';

export default function CampaignContributionTrackingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, session } = useAuth();
  const [campaign, setCampaign] = useState<ContributionCampaign | null>(null);
  const [records, setRecords] = useState<Awaited<ReturnType<typeof readCampaignDemoContributions>>>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const target = await loadContributionCampaign(id ?? '', { userId: user?.id, accessToken: session?.access_token });
        if (!target) { if (active) setError('This campaign could not be found.'); return; }
        const items = target.origin === 'api'
          ? (session?.access_token ? await listDemoContributionsFromApi(target.id, session.access_token) : [])
          : target.origin === 'catalog' ? await readCampaignDemoContributions(target.id) : [];
        if (active) { setCampaign(target); setRecords(items); }
      } catch (caught) { if (active) setError(caught instanceof Error ? caught.message : 'Campaign tracking data could not be loaded.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [id, session?.access_token, user?.id]);

  if (loading) return <FlowPage title="Campaign tracking" subtitle="Loading the latest available progress…" />;
  if (!campaign) return <FlowPage title="Campaign unavailable" subtitle={error}>
    <FlowButton title="Return to Explore" onPress={() => router.replace('/explore' as never)} />
  </FlowPage>;

  const contributionsMinor = records.reduce((total, item) => Math.min(Number.MAX_SAFE_INTEGER, total + (campaign.currency === 'INR' ? campaignFundingMinorForContribution(item) : item.amountMinor)), 0);
  const raisedMinor = campaign.seededRaisedMinor + contributionsMinor;
  const progress = calculateFundingProgress(campaign.goalMinor, raisedMinor);
  const reach = campaign.currency === 'INR'
    ? Math.round((contributionsMinor / 100) * DEMO_REACH_PER_RUPEE)
    : Math.round((contributionsMinor / 100) * DEMO_REACH_PER_DOLLAR);

  return <FlowPage title="Campaign tracking" subtitle="A clear view of simulated funding and the campaign’s currently available reporting data.">
    <CampaignIdentity campaign={campaign} />
    <FlowCard title="Funding progress">
      <MoneyRow label="Funding goal" value={formatContributionMoney(campaign.goalMinor, campaign.currency)} />
      <MoneyRow label="Fictional catalogue seed" value={formatContributionMoney(campaign.seededRaisedMinor, campaign.currency)} />
      <MoneyRow label="Simulated contributions" value={formatContributionMoney(contributionsMinor, campaign.currency)} />
      <MoneyRow label="Current demo total" value={formatContributionMoney(raisedMinor, campaign.currency)} strong />
      <MoneyRow label="Progress toward goal" value={progress.percentage === null ? 'Unavailable' : `${progress.percentage.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`} />
      <View style={styles.track} accessibilityRole="progressbar" accessibilityLabel="Campaign funding progress" accessibilityValue={progress.percentage === null ? undefined : { min: 0, max: 100, now: Math.round(progress.barPercentage) }}>
        <View style={[styles.fill, { width: `${progress.barPercentage}%` }]} />
      </View>
      <Text style={styles.hint}>Progress does not change the campaign lifecycle status automatically. All funding figures remain demo or simulated data.</Text>
      {campaign.currency === 'INR' ? <Text style={styles.hint}>USD contributions are shown against INR catalogue goals using the fixed demo-only $1 = ₹80 assumption; this is not a live exchange rate.</Text> : null}
    </FlowCard>

    <FlowCard title="Distribution reporting">
      <MoneyRow label="Funds raised (simulated)" value={formatContributionMoney(contributionsMinor, campaign.currency)} />
      <MoneyRow label="Advertising spend" value="Unavailable · no ads have been run through SIGNAL" />
      <MoneyRow label="Impressions" value="Unavailable" />
      <MoneyRow label="Estimated potential reach" value={`${reach.toLocaleString('en-US')} possible views`} />
      <MoneyRow label="Measured reach" value="Unavailable" />
      <MoneyRow label="Clicks and engagement" value="Unavailable" />
      <Text style={styles.hint}>Estimated potential reach is separate from impressions and measured reach. No ad-delivery integration or final campaign report is configured.</Text>
    </FlowCard>

    <FlowCard title="Available updates">
      {records.length ? records.slice().reverse().map((record) => <View key={record.id} style={styles.record}>
        <Text style={styles.recordTitle}>{record.displayFirstName ? `${record.displayFirstName} · ` : ''}{formatContributionMoney(record.amountMinor)} simulated contribution</Text>
        <Text style={styles.hint}>{record.createdAt ? new Date(record.createdAt).toLocaleString() : 'Contribution date unavailable'} · no real payment was made</Text>
      </View>) : <Text style={styles.body}>No contribution updates are available yet.</Text>}
      {campaign.origin === 'catalog' ? <Text style={styles.hint}>These fictional campaign records are saved on this device and are not shared with SIGNAL or other devices.</Text> : null}
    </FlowCard>

    <InfoNote>No verified trust score, endorsement, ad spend, delivery report, or measured results are available for this campaign.</InfoNote>
    {error ? <InfoNote tone="error">{error}</InfoNote> : null}
    <FlowButton title="Return to campaign" onPress={() => router.replace({ pathname: '/campaign/[id]', params: { id: campaign.routeId } } as never)} />
  </FlowPage>;
}

const styles = {
  track: { height: 9, borderRadius: 5, backgroundColor: C.line, overflow: 'hidden' as const, marginVertical: 4 },
  fill: { height: '100%' as const, borderRadius: 5, backgroundColor: C.green },
  body: { color: C.muted, fontSize: 13, lineHeight: 20 },
  hint: { color: C.muted, fontSize: 11, lineHeight: 17 },
  record: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 10, gap: 3 },
  recordTitle: { color: C.text, fontSize: 13, lineHeight: 18, fontWeight: '700' as const },
};
