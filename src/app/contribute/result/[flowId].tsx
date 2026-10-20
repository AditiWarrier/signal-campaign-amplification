import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Share, Text, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { CampaignIdentity, FlowButton, FlowCard, FlowLink, FlowPage, InfoNote, MoneyRow, formatContributionMoney } from '@/components/contributions/flow-ui';
import { resolveContributionActivityOwner, retryContributionConfirmation } from '@/data/contribution-processing';
import { loadContributionCampaign, type ContributionCampaign } from '@/data/contribution-campaign';
import { readCampaignDemoContributions } from '@/data/demo-contributions';
import { readContributionFlow, updateContributionFlow, writeContributionFlow, type ContributionFlow } from '@/data/contribution-flow';
import { campaignFundingMinorForContribution } from '@/data/demo-reach';
import { listDemoContributionsFromApi } from '@/data/signal-api';
import { calculateFundingProgress } from '@/data/funding';
import { Palette as C } from '@/constants/theme';

export default function ContributionResultScreen() {
  const { flowId } = useLocalSearchParams<{ flowId: string }>();
  const { user, session, isLoading: authLoading } = useAuth();
  const [flow, setFlow] = useState<ContributionFlow | null>(null);
  const [campaign, setCampaign] = useState<ContributionCampaign | null>(null);
  const [raisedMinor, setRaisedMinor] = useState<number | null>(null);
  const [progressNote, setProgressNote] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const saved = await readContributionFlow(flowId ?? '');
        if (!saved) { if (active) setError('The saved result is unavailable. No successful contribution is displayed.'); return; }
        const target = await loadContributionCampaign(saved.campaignRouteId, { userId: user?.id, accessToken: session?.access_token });
        if (active) { setFlow(saved); setCampaign(target); }
        if (!target) { if (active) setError('The associated campaign could not be loaded.'); return; }
        if (saved.status === 'success' && saved.contribution) {
          try {
            const records = target.origin === 'api'
              ? (session?.access_token ? await listDemoContributionsFromApi(target.id, session.access_token) : [])
              : target.origin === 'catalog' ? await readCampaignDemoContributions(target.id) : [];
            const sum = records.reduce((total, item) => Math.min(Number.MAX_SAFE_INTEGER, total + (target.currency === 'INR' ? campaignFundingMinorForContribution(item) : item.amountMinor)), 0);
            if (active) setRaisedMinor(target.seededRaisedMinor + sum);
          } catch (caught) {
            if (active) setProgressNote(caught instanceof Error ? caught.message : 'Current progress could not be refreshed.');
          }
        }
      } catch (caught) { if (active) setError(caught instanceof Error ? caught.message : 'The result could not be loaded.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [flowId, session?.access_token, user?.id]);

  const reference = useMemo(() => flow ? `SIGNAL-DEMO-${flow.id.slice(-12).toUpperCase()}` : '', [flow]);
  const shareUrl = campaign && Platform.OS === 'web' && typeof window !== 'undefined'
    ? `${window.location.origin}/campaign/${encodeURIComponent(campaign.routeId)}`
    : campaign ? `campaignamplification:///campaign/${encodeURIComponent(campaign.routeId)}` : '';

  async function shareCampaign() {
    if (!campaign) return;
    const shareText = `I supported ${campaign.title} on SIGNAL. Learn about the campaign: ${shareUrl}`;
    setMessage(''); setError('');
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try { await navigator.share({ title: campaign.title, text: shareText, url: shareUrl }); return; }
      catch (caught) { if (caught instanceof Error && caught.name === 'AbortError') return; }
    } else if (Platform.OS !== 'web') {
      try { await Share.share({ title: campaign.title, message: shareText, url: shareUrl }); return; }
      catch { setError('The device share sheet could not be opened. No share was sent.'); return; }
    }
    await copyCampaignLink();
  }

  async function copyCampaignLink() {
    if (!shareUrl) return;
    try {
      const copied = await Clipboard.setStringAsync(shareUrl);
      setMessage(copied ? 'Campaign link copied.' : 'The browser did not allow clipboard access. Select the campaign URL from the address bar to copy it.');
    } catch { setMessage('Clipboard access is unavailable. No share was sent.'); }
  }

  async function restartCheckout() {
    if (!flow) return;
    setError('');
    try {
      await writeContributionFlow(updateContributionFlow(flow, { status: 'checkout', outcome: undefined, error: undefined }));
      router.push({ pathname: '/contribute/checkout/[flowId]', params: { flowId: flow.id } } as never);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Checkout could not be reopened.'); }
  }

  async function retryConfirmation() {
    if (!flow || retrying) return;
    if (flow.status !== 'success' && resolveContributionActivityOwner(authLoading, user?.id) === null) return;
    setRetrying(true); setError('');
    try {
      const ownerId = flow.status === 'success'
        ? undefined
        : resolveContributionActivityOwner(authLoading, user?.id) ?? undefined;
      const finalFlow = await retryContributionConfirmation(flow.id, session?.access_token, ownerId);
      if (!finalFlow) throw new Error('The saved confirmation is unavailable.');
      setFlow(finalFlow);
      if (finalFlow.status === 'success' && flow.status !== 'success') {
        setRaisedMinor(null);
        setProgressNote('Refresh this page to load the latest campaign total.');
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Confirmation could not be retried.'); }
    finally { setRetrying(false); }
  }

  if (loading) return <FlowPage title="Contribution result" subtitle="Loading the saved demo result…" />;
  if (!flow) return <FlowPage title="Result unavailable" subtitle={error}>
    <FlowButton title="Return to Explore" onPress={() => router.replace('/explore' as never)} />
  </FlowPage>;

  const success = flow.status === 'success' && Boolean(flow.contribution);
  const progress = campaign && raisedMinor !== null ? calculateFundingProgress(campaign.goalMinor, raisedMinor) : null;
  const icon = success ? '✓' : flow.status === 'cancelled' ? '↩' : '×';

  return <FlowPage title={success ? 'Your Support Helps Their Voice Travel Further.' : flow.status === 'rejected' ? 'Simulated payment rejected' : flow.status === 'cancelled' ? 'Checkout cancelled' : 'Contribution not confirmed'} subtitle={success ? "Your demo contribution has been recorded successfully. You're helping this campaign's message reach more people." : 'No real payment was attempted or charged.'}>
    <View style={[styles.resultMark, success && styles.resultMarkSuccess]} accessibilityLabel={success ? 'Simulated contribution recorded' : 'No successful contribution recorded'}>
      <Text style={styles.resultIcon}>{icon}</Text>
    </View>
    {campaign ? <CampaignIdentity campaign={campaign} /> : null}

    {success && flow.contribution ? <>
      <FlowCard title="Contribution summary">
        <MoneyRow label="Campaign" value={campaign?.title ?? flow.campaignTitle} />
        <MoneyRow label="Contribution" value={formatContributionMoney(flow.contribution.amountMinor)} />
        <MoneyRow label="Fees" value={`${formatContributionMoney(flow.contribution.feeMinor ?? 0)} · none configured`} />
        <MoneyRow label="Total" value={formatContributionMoney(flow.contribution.totalMinor ?? flow.contribution.amountMinor)} strong />
        <MoneyRow label="Demo receipt reference" value={reference} />
        {flow.contribution.displayFirstName ? <MoneyRow label="Recent backer display" value={flow.contribution.displayFirstName} /> : null}
        <InfoNote>{flow.origin === 'catalog'
          ? 'This is a simulated transaction only, saved in the local demo ledger on this device. It is not a real payment receipt, and no payment provider processed a charge.'
          : 'This is a simulated transaction only, recorded by the configured SIGNAL demo backend. It is not a real payment receipt, and no payment provider processed a charge.'}</InfoNote>
        <FlowLink title="Open demo receipt" onPress={() => router.push({ pathname: '/contribute/receipt/[flowId]', params: { flowId: flow.id } } as never)} />
      </FlowCard>

      <FlowCard title="Estimated potential reach">
        <Text style={styles.reach}>{flow.estimatedPotentialReach.toLocaleString('en-US')}</Text>
        <Text style={styles.body}>Approximately {flow.estimatedPotentialReach.toLocaleString('en-US')} people could see this campaign because of you.</Text>
        <Text style={styles.hint}>This is estimated potential reach under the campaign’s demo model. It is not measured impressions, actual reach, or guaranteed views.</Text>
        {campaign ? <MoneyRow label="Campaign" value={campaign.title} /> : null}
      </FlowCard>

      <FlowCard title="Campaign progress">
        {campaign ? <>
          <MoneyRow label="Funding goal" value={formatContributionMoney(campaign.goalMinor, campaign.currency)} />
          <MoneyRow label="Current simulated progress" value={raisedMinor === null ? 'Unavailable' : formatContributionMoney(raisedMinor, campaign.currency)} />
          <MoneyRow label="Funding progress" value={progress?.percentage === null || !progress ? 'Unavailable' : `${progress.percentage.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`} />
          {progress ? <View accessibilityRole="progressbar" accessibilityLabel="Updated campaign funding progress" accessibilityValue={progress.percentage === null ? undefined : { min: 0, max: 100, now: Math.round(progress.barPercentage) }} style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress.barPercentage}%` }]} /></View> : null}
        </> : null}
        <Text style={styles.hint}>No verified trust score, independent endorsement, ad spend, delivery report, or measured reach is available in this demo.</Text>
        {progressNote ? <Text style={styles.hint}>{progressNote}</Text> : null}
      </FlowCard>

      <FlowCard title="Reach more people">
        <Text style={styles.body}>Invite others to read about this campaign. Sharing is optional and does not mean a share has already occurred.</Text>
        <FlowButton title="Share campaign" onPress={() => { void shareCampaign(); }} />
        <FlowButton title="Copy campaign link" secondary onPress={() => { void copyCampaignLink(); }} />
        {message ? <InfoNote tone="success">{message}</InfoNote> : null}
      </FlowCard>
      <FlowButton title="Return to campaign" onPress={() => campaign && router.replace({ pathname: '/campaign/[id]', params: { id: campaign.routeId } } as never)} />
      <FlowButton title="View campaign progress" secondary onPress={() => campaign && router.push({ pathname: '/contribute/tracking/[id]', params: { id: campaign.routeId } } as never)} />
    </> : <>
      <FlowCard title="Demo checkout outcome">
        <Text style={styles.body}>{flow.status === 'rejected'
          ? 'The selected simulated outcome was rejection. No contribution record or funding increase was created.'
          : flow.status === 'cancelled'
            ? 'Checkout was cancelled. No contribution record or funding increase was created.'
            : flow.outcome === 'failed' && !flow.error
              ? 'The selected simulated outcome was failure. No contribution record or funding increase was created.'
            : flow.error
              ? `The demo contribution could not be confirmed: ${flow.error}`
              : 'The simulated flow did not produce a confirmed contribution.'}</Text>
        <InfoNote>No real payment was attempted or charged.</InfoNote>
      </FlowCard>
      {flow.activityEventPending ? <FlowCard title="Activity update pending">
        <Text style={styles.body}>Your contribution succeeded, but its Activity entry could not be saved yet.</Text>
        <FlowButton title={retrying ? 'Saving activity…' : 'Retry Activity Update'} secondary disabled={retrying} onPress={() => { void retryConfirmation(); }} />
      </FlowCard> : null}
      {flow.status === 'failed' && flow.outcome === 'success' ? <FlowButton title={authLoading ? 'Restoring session…' : retrying ? 'Checking confirmation…' : 'Retry confirmation'} disabled={retrying || authLoading} onPress={() => { void retryConfirmation(); }} /> : null}
      {flow.status === 'rejected' || flow.status === 'failed' || flow.status === 'cancelled' ? <FlowButton title="Choose another demo outcome" onPress={() => { void restartCheckout(); }} /> : null}
      <FlowButton title="Return to campaign" secondary onPress={() => campaign && router.replace({ pathname: '/campaign/[id]', params: { id: campaign.routeId } } as never)} />
    </>}
    {error ? <InfoNote tone="error">{error}</InfoNote> : null}
  </FlowPage>;
}

const styles = {
  resultMark: { width: 66, height: 66, borderRadius: 33, alignSelf: 'center' as const, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: C.maroonLight, borderWidth: 1, borderColor: C.maroon },
  resultMarkSuccess: { backgroundColor: C.backgroundSelected, borderColor: C.green },
  resultIcon: { color: C.green, fontSize: 34, lineHeight: 40, fontWeight: '800' as const },
  reach: { color: C.green, fontSize: 34, lineHeight: 40, fontWeight: '800' as const },
  body: { color: C.muted, fontSize: 13, lineHeight: 20 },
  hint: { color: C.muted, fontSize: 11, lineHeight: 17 },
  progressTrack: { height: 9, borderRadius: 5, backgroundColor: C.line, overflow: 'hidden' as const, marginVertical: 5 },
  progressFill: { height: '100%' as const, borderRadius: 5, backgroundColor: C.green },
};
