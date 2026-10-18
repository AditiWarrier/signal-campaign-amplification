import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette as C } from '@/constants/theme';
import { discoveryCampaigns, formatIsoDate, getDeadlineLabel, isDeadlineExpired } from '@/data/campaigns';
import { readLocalCampaign } from '@/data/campaign-draft-storage';
import { getCampaignFromApi } from '@/data/signal-api';
import { addDemoContribution, readDemoContributions } from '@/data/demo-contributions';
import { readCampaignDemoContributions } from '@/data/demo-contributions';
import { formatUsdMinor, parseUsdMinor } from '@/data/funding';
import { FundingSummary } from '@/components/funding-summary';
import { useAuth } from '@/auth/auth-context';
import { DEMO_REACH_PER_DOLLAR, type LocalCampaignDraft } from '@/types/local-campaign';
import type { LocalDemoContribution } from '@/types/local-campaign';
import { useUtcToday } from '@/hooks/use-utc-today';

function makeDemoOperationKey(campaignId: string): string {
  return `demo-op-${campaignId}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function goBackOr(fallback: '/explore' | '/create') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as never);
}

export default function CampaignDetailsScreen() {
  const { id, owner } = useLocalSearchParams<{ id: string; owner?: string }>();
  const today = useUtcToday();
  const { user, session } = useAuth();
  const isRemoteCampaign = id?.startsWith('api-') ?? false;
  const localId = id?.startsWith('local-') || isRemoteCampaign ? id.slice(id.indexOf('-') + 1) : '';
  const [localCampaign, setLocalCampaign] = useState<LocalCampaignDraft | null>(null);
  const [localLoading, setLocalLoading] = useState(Boolean(localId));
  const campaign = discoveryCampaigns.find((item) => item.id === id);

  useEffect(() => {
    let active = true;
    if (!localId) { setLocalLoading(false); return () => { active = false; }; }
    setLocalLoading(true);
    const storageOwner = owner === 'device-draft' ? owner : (user?.id ?? 'device-draft');
    const load = isRemoteCampaign && session?.access_token
      ? getCampaignFromApi(localId, session.access_token)
      : isRemoteCampaign
        ? Promise.resolve(null)
        : readLocalCampaign(storageOwner, localId);
    void load.then((value) => {
      if (active) setLocalCampaign(value);
    }).catch(() => {
      if (active) setLocalCampaign(null);
    }).finally(() => { if (active) setLocalLoading(false); });
    return () => { active = false; };
  }, [isRemoteCampaign, localId, owner, session?.access_token, user?.id]);

  if (localId) {
    if (localLoading) return <SafeAreaView style={styles.safe}><View style={styles.notFound}><Text style={styles.copy}>Opening your saved campaign…</Text></View></SafeAreaView>;
    if (!localCampaign) return <SafeAreaView style={styles.safe}><View style={styles.notFound}>
      <Text style={styles.title}>Saved campaign unavailable</Text>
      <Text style={styles.copy}>This locally submitted campaign could not be found in this account’s device storage.</Text>
      <Pressable accessibilityRole="button" onPress={() => goBackOr('/create')} style={styles.backButton}><Text style={styles.backButtonText}>Back to previous screen</Text></Pressable>
    </View></SafeAreaView>;
    return <LocalCampaignDetails campaign={localCampaign} userId={owner === 'device-draft' ? owner : (user?.id ?? 'device-draft')} />;
  }

  if (!campaign) {
    return <SafeAreaView style={styles.safe}>
      <View style={styles.notFound}>
        <Text style={styles.title}>Campaign not found</Text>
        <Text style={styles.copy}>This demo campaign may no longer be available.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/explore' as never)} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back to Explore</Text>
        </Pressable>
      </View>
    </SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="button" onPress={() => goBackOr('/explore')} style={styles.backLink}>
          <Text style={styles.backLinkText}>‹  Back to Explore</Text>
        </Pressable>
        <View style={[styles.cover, { backgroundColor: campaign.coverColor }]}>
          <View style={styles.coverEmblem}><Text style={styles.coverSymbol}>{campaign.coverSymbol}</Text></View>
          <Text style={styles.coverCaption}>ILLUSTRATIVE COVER · FICTIONAL DEMO</Text>
        </View>
        <View style={styles.categoryRow}>
          <Text style={styles.category}>{campaign.category.toUpperCase()}</Text>
          <Text style={styles.status}>{campaign.status}</Text>
        </View>
        <Text style={styles.title}>{campaign.title}</Text>
        <Text style={styles.cause}>{campaign.cause}</Text>
        <Text style={styles.creator}>Created by {campaign.creator}</Text>
        <Text style={styles.meta}>Campaign created {formatIsoDate(campaign.createdAt)} · {campaign.country}</Text>
        <Text style={styles.description}>{campaign.description}</Text>

        <DemoFixtureFunding campaign={campaign} userId={user?.id} contributorName={user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0]} today={today} />
        <Text style={styles.deadline}>{getDeadlineLabel(campaign.fundingDeadline, today)} · deadline {formatIsoDate(campaign.fundingDeadline)}</Text>

        <View style={styles.distributionCard}>
          <Text style={styles.distributionLabel}>PLANNED DISTRIBUTION PLATFORM</Text>
          <Text style={styles.platform}>{campaign.platform}</Text>
          <Text style={styles.distributionCopy}>This is the campaign creator’s intended platform. No campaign ads are currently running through SIGNAL.</Text>
          <Text style={styles.reach}>Illustrative potential reach at goal: ~{campaign.estimatedReachAtGoal.toLocaleString()} people. This is not ad spend or delivered reach.</Text>
        </View>
        <Text style={styles.footer}>Contributions support message distribution and amplification, not a direct donation to the underlying cause.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function DemoFixtureFunding({ campaign, userId, contributorName, today }: {
  campaign: (typeof discoveryCampaigns)[number];
  userId?: string;
  contributorName?: string;
  today: ReturnType<typeof useUtcToday>;
}) {
  const [contributions, setContributions] = useState<LocalDemoContribution[]>([]);
  const [amountMinor, setAmountMinor] = useState(1000);
  const [savedAmount, setSavedAmount] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submitLock = useRef(false);
  const operationKey = useRef(makeDemoOperationKey(campaign.id));
  const eligible = campaign.status !== 'In review' && !isDeadlineExpired(campaign.fundingDeadline, today);
  // Fictional creator IDs are separate from auth users; anonymous demo support uses
  // one stable device identity so it does not require creating another account.
  const contributorId = userId || 'device-demo-supporter';
  const ownCampaign = contributorId === campaign.creatorId;
  const simulatedMinor = contributions.reduce((total, item) => Math.min(Number.MAX_SAFE_INTEGER, total + item.amountMinor), 0);
  const seededMinor = parseUsdMinor(campaign.raised);
  const demoTotalMinor = Math.min(Number.MAX_SAFE_INTEGER, seededMinor + simulatedMinor);

  useEffect(() => {
    let active = true;
    void readCampaignDemoContributions(campaign.id).then((items) => {
      if (active) setContributions(items);
    }).catch(() => {
      if (active) setError('Local demo contribution storage is unavailable. No contribution was recorded.');
    });
    return () => { active = false; };
  }, [campaign.id]);

  async function recordDemoContribution() {
    if (submitLock.current || !eligible || ownCampaign || savedAmount !== null) return;
    submitLock.current = true;
    setSaving(true);
    setError('');
    try {
      const saved = await addDemoContribution(contributorId, campaign.id, amountMinor, operationKey.current, contributorName || 'Demo supporter');
      const updated = await readCampaignDemoContributions(campaign.id);
      setContributions(updated);
      setSavedAmount(saved.amountMinor);
      setMessage(`${formatUsdMinor(saved.amountMinor)} simulated contribution recorded for this fictional campaign on this device. No payment was made.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The demo contribution could not be saved.');
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  }

  function chooseAmount(value: number) {
    setAmountMinor(value);
    setSavedAmount(null);
    setMessage('');
    setError('');
    operationKey.current = makeDemoOperationKey(campaign.id);
  }

  return <>
    <FundingSummary
      goalMinor={parseUsdMinor(campaign.goal)}
      progressMinor={demoTotalMinor}
      progressLabel="Fictional seed + simulated demo total"
      contributionCount={contributions.length}
      verifiedRaisedMinor={0}
      note="The starting total is fictional demo data; added records are simulated contributions stored on this device. Verified funds received remain $0."
    />
    {ownCampaign ? <View style={styles.contributionBox}>
      <Text style={styles.localSectionTitle}>You can't fund your own campaign</Text>
      <Text style={styles.distributionCopy}>SIGNAL is built around community-powered amplification. Explore campaigns by other creators to contribute.</Text>
    </View>
      : eligible ? <View style={styles.contributionBox}>
        <Text style={styles.localSectionTitle}>Try a demo contribution</Text>
        <Text style={styles.distributionCopy}>Fictional campaign demo only. This records a simulated contribution locally; it does not charge a payment method or send money.</Text>
        <View style={styles.amountChoices}>{[500, 1000, 2500, 5000].map((value) => {
          const selected = amountMinor === value;
          return <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected }} disabled={saving} onPress={() => chooseAmount(value)} style={[styles.amountChoice, selected && styles.amountChoiceSelected, saving && styles.simulateButtonDisabled]}>
            <Text style={[styles.amountChoiceText, selected && styles.amountChoiceTextSelected]}>{formatUsdMinor(value)}</Text>
          </Pressable>;
        })}</View>
        <Pressable accessibilityRole="button" disabled={saving || savedAmount !== null} onPress={() => { void recordDemoContribution(); }} style={({ pressed }) => [styles.simulateButton, (saving || savedAmount !== null) && styles.simulateButtonDisabled, pressed && styles.pressed]}>
          <Text style={styles.simulateButtonText}>{savedAmount !== null ? 'Demo contribution saved' : saving ? 'Saving demo record…' : 'Back this Campaign'}</Text>
        </Pressable>
        {message ? <Text accessibilityRole="alert" style={styles.contributionSuccess}>{message}</Text> : null}
        {error ? <Text accessibilityRole="alert" style={styles.contributionError}>{error}</Text> : null}
      </View> : <View style={styles.contributionBox}><Text style={styles.distributionCopy}>Demo contributions are unavailable because this fictional campaign is under review or its sample funding period has ended.</Text></View>}
  </>;
}

function LocalCampaignDetails({ campaign, userId }: { campaign: LocalCampaignDraft; userId: string }) {
  const [contributions, setContributions] = useState<Awaited<ReturnType<typeof readDemoContributions>>>([]);
  const [contributionError, setContributionError] = useState('');
  const goalMinor = parseUsdMinor(campaign.fundingGoal);
  const simulatedMinor = contributions.reduce((total, item) => Math.min(Number.MAX_SAFE_INTEGER, total + item.amountMinor), 0);
  const instagramBudgetMinor = parseUsdMinor(campaign.instagramBudget);
  const facebookBudgetMinor = parseUsdMinor(campaign.facebookBudget);
  const allocatedMinor = Math.min(Number.MAX_SAFE_INTEGER, instagramBudgetMinor + facebookBudgetMinor);
  const reachEstimate = Math.round((allocatedMinor / 100) * DEMO_REACH_PER_DOLLAR);
  const amount = (value: string) => formatUsdMinor(parseUsdMinor(value));

  useEffect(() => {
    let active = true;
    void readDemoContributions(userId, campaign.id).then((items) => {
      if (!active) return;
      setContributions(items);
    }).catch(() => {
      if (active) setContributionError('Local demo contribution storage is unavailable. No contribution was recorded.');
    });
    return () => { active = false; };
  }, [campaign.id, userId]);

  const openSource = (url: string) => { void Linking.openURL(url).catch(() => undefined); };
  return <SafeAreaView style={styles.safe} edges={['top']}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Pressable accessibilityRole="button" onPress={() => goBackOr('/create')} style={styles.backLink}>
        <Text style={styles.backLinkText}>‹  Back to previous screen</Text>
      </Pressable>
      <View style={styles.localStatusBox}>
        <Text style={styles.localStatusEyebrow}>{campaign.apiSubmissionStatus === 'submitted' ? 'SIGNAL API CAMPAIGN' : 'LOCAL CAMPAIGN'}</Text>
      <Text style={styles.localStatusText}>{campaign.localStatus === 'submitted_locally' ? campaign.apiSubmissionStatus === 'submitted' ? 'Accepted by SIGNAL API · awaiting review' : campaign.apiSubmissionStatus === 'sync_failed' ? 'Saved locally · backend sync failed' : 'Submitted locally — awaiting backend connection' : 'Saved draft on this device'}</Text>
      <Text style={styles.disclaimer}>{campaign.localStatus === 'submitted_locally' ? campaign.apiSubmissionStatus === 'submitted' ? 'Supabase confirmed this campaign submission for your account. It is awaiting review; no reviewer decision or real funding is claimed.' : campaign.apiSubmissionStatus === 'sync_failed' ? 'This submission is saved on this device. The backend did not confirm receipt, and no review status is claimed.' : 'Saved on this device only. It has not been sent to SIGNAL or Supabase, and review has not begun.' : 'This campaign is a local draft. It has not been submitted to SIGNAL or Supabase.'}</Text>
      </View>
      <View style={styles.localSection}>
        <Text style={styles.category}>{campaign.category || 'CAMPAIGN'}</Text>
        <Text style={styles.title}>{campaign.title || 'Untitled campaign'}</Text>
        <Text style={styles.cause}>{campaign.summary || 'No summary provided.'}</Text>
        <Text style={styles.creator}>Created by {campaign.creatorName || 'Creator not specified'}</Text>
      </View>
      <FundingSummary
        goalMinor={goalMinor}
        progressMinor={simulatedMinor}
        progressLabel="Simulated demo contributions"
        contributionCount={contributions.length}
        verifiedRaisedMinor={0}
        note="Demo progress only. No payment is processed and no money has been received. Actual verified funds remain $0 until a trusted payment service is connected."
      />
      {campaign.localStatus === 'submitted_locally' ? <View style={styles.contributionBox}>
        <Text style={styles.localSectionTitle}>You can't fund your own campaign</Text>
        <Text style={styles.distributionCopy}>SIGNAL is built around community-powered amplification. Explore campaigns by other creators to contribute.</Text>
      </View> : null}
      {contributionError ? <Text accessibilityRole="alert" style={styles.contributionError}>{contributionError}</Text> : null}
      <View style={styles.localSection}>
        <Text style={styles.localSectionTitle}>Story</Text>
        <Text style={styles.distributionLabel}>{campaign.storyHeadline || 'Story headline not provided'}</Text>
        <Text style={styles.description}>{campaign.introduction || 'No introduction provided.'}</Text>
        {campaign.sections.map((section, index) => <View key={section.id} style={styles.localStorySection}>
          <Text style={styles.localSectionTitle}>{section.heading || `Story section ${index + 1}`}</Text>
          <Text style={styles.description}>{section.body}</Text>
        </View>)}
        {campaign.audienceActions ? <Text style={styles.description}><Text style={styles.localInlineLabel}>Suggested audience actions: </Text>{campaign.audienceActions}</Text> : null}
      </View>
      <View style={styles.localSection}>
        <Text style={styles.localSectionTitle}>Supporting sources</Text>
        {campaign.sources.length ? campaign.sources.map((source, index) => <Pressable key={source.id} accessibilityRole="link" onPress={() => openSource(source.url)} style={styles.sourceItem}>
          <Text style={styles.sourceTitle}>{index + 1}. {source.title}</Text>
          <Text style={styles.sourceUrl}>{source.url}</Text>
        </Pressable>) : <Text style={styles.description}>No supporting sources added.</Text>}
      </View>
      <View style={styles.localSection}>
        <Text style={styles.localSectionTitle}>Campaign and ad creative</Text>
        <Text style={styles.detailValue}>Cover image reference: {campaign.coverUri || 'Not provided'}</Text>
        {campaign.coverAlt ? <Text style={styles.detailValue}>Cover image description: {campaign.coverAlt}</Text> : null}
        <Text style={styles.detailValue}>Ad headline: {campaign.adHeadline || campaign.title}</Text>
        <Text style={styles.detailValue}>Ad description: {campaign.adDescription || 'Not provided'}</Text>
        <Text style={styles.detailValue}>Call to action: {campaign.callToAction || 'Not provided'}</Text>
        <Text style={styles.detailValue}>Ad image reference: {campaign.adImageUri || 'Not provided'}</Text>
        {campaign.adImageAlt ? <Text style={styles.detailValue}>Ad image description: {campaign.adImageAlt}</Text> : null}
        {campaign.adImageMetadata ? <Text style={styles.detailValue}>Ad image metadata: {campaign.adImageMetadata}</Text> : null}
        <Text style={styles.disclaimer}>Image references are draft metadata only; no image file was uploaded.</Text>
      </View>
      <View style={styles.localSection}>
        <Text style={styles.localSectionTitle}>Audience and distribution plan</Text>
        <Text style={styles.detailValue}>Target locations: {campaign.locations.join(', ') || 'Not provided'}</Text>
        <Text style={styles.detailValue}>Audience ages: {campaign.minimumAge || 'Not set'} to {campaign.maximumAge || 'No maximum'}</Text>
        <Text style={styles.detailValue}>Interests: {campaign.interests || 'Not provided'}</Text>
        <Text style={styles.detailValue}>Channels: {campaign.channels.map((channel) => channel === 'instagram' ? 'Instagram' : 'Facebook').join(', ') || 'Not provided'}</Text>
        <Text style={styles.detailValue}>Duration: {campaign.durationDays || 'Not set'} days</Text>
        <Text style={styles.detailValue}>Instagram budget: {amount(campaign.instagramBudget)}</Text>
        <Text style={styles.detailValue}>Facebook budget: {amount(campaign.facebookBudget)}</Text>
        <Text style={styles.detailValue}>Total planned allocation: {formatUsdMinor(allocatedMinor)}</Text>
        <Text style={styles.detailValue}>Creator-set funding goal: {goalMinor > 0 ? formatUsdMinor(goalMinor) : 'Not set'}</Text>
        <Text style={styles.reach}>Illustrative estimated potential reach: ~{reachEstimate.toLocaleString()} potential views</Text>
        <Text style={styles.disclaimer}>Uses a configurable demo assumption of {DEMO_REACH_PER_DOLLAR} potential views per $1 allocated. This is not platform data, verified reach, or a guarantee. Actual reach may vary.</Text>
        <Text style={styles.disclaimer}>Planned channel allocations are not funds raised. Estimated potential reach is not actual ad spend or delivered audience.</Text>
        <Text style={styles.distributionCopy}>Targeting and final placements are creator-selected proposals and may be finalized during platform review. No review has started.</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={() => router.replace({ pathname: '/create', params: { newDraft: String(Date.now()) } } as never)} style={styles.backButton}>
        <Text style={styles.backButtonText}>Start another campaign</Text>
      </Pressable>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  content: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 32, maxWidth: 680, width: '100%', alignSelf: 'center' },
  backLink: { alignSelf: 'flex-start', paddingVertical: 10, paddingRight: 12, marginBottom: 9 },
  backLinkText: { color: C.text, fontSize: 13, fontWeight: '700' },
  cover: { height: 178, alignItems: 'center', justifyContent: 'center', borderRadius: 9, overflow: 'hidden', marginBottom: 18 },
  coverEmblem: { width: 66, height: 66, alignItems: 'center', justifyContent: 'center', borderRadius: 33, backgroundColor: 'rgba(116,86,63,0.88)' },
  coverSymbol: { color: C.text, fontSize: 38, lineHeight: 42 },
  coverCaption: { position: 'absolute', right: 11, bottom: 10, color: 'rgba(48,42,37,0.55)', fontSize: 8, fontWeight: '700', letterSpacing: 0.8 },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 9 },
  category: { color: C.green, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  status: { color: C.text, backgroundColor: C.brownLight, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5, fontSize: 9, fontWeight: '600', overflow: 'hidden' },
  title: { color: C.text, fontSize: 28, lineHeight: 34, fontWeight: '600', letterSpacing: -0.5 },
  cause: { color: C.text, fontSize: 13, fontWeight: '600', marginTop: 5 },
  creator: { color: C.muted, fontSize: 11, marginTop: 8 },
  meta: { color: C.muted, fontSize: 10, marginTop: 5 },
  description: { color: C.text, fontSize: 14, lineHeight: 22, marginTop: 16 },
  reach: { color: C.text, fontSize: 11, marginTop: 11 },
  deadline: { color: C.text, fontSize: 11, fontWeight: '700', marginTop: 10 },
  disclaimer: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 7 },
  distributionCard: { borderRadius: 9, backgroundColor: C.surfaceSoft, padding: 16, marginTop: 13 },
  distributionLabel: { color: C.text, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  platform: { color: C.text, fontSize: 17, fontWeight: '700', marginTop: 7 },
  distributionCopy: { color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 5 },
  footer: { color: C.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 18 },
  notFound: { flex: 1, justifyContent: 'center', padding: 24 },
  localStatusBox: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 9, padding: 15, marginBottom: 19, gap: 7 },
  localStatusEyebrow: { color: C.green, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  localStatusText: { color: C.text, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  localSection: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line, gap: 7 },
  localSectionTitle: { color: C.text, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  localStorySection: { borderLeftWidth: 2, borderLeftColor: C.line, paddingLeft: 12, paddingVertical: 5, gap: 4 },
  localInlineLabel: { color: C.text, fontWeight: '700' },
  sourceItem: { paddingVertical: 5, gap: 3 },
  sourceTitle: { color: C.text, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  sourceUrl: { color: C.green, fontSize: 11, lineHeight: 16, textDecorationLine: 'underline' },
  detailValue: { color: C.muted, fontSize: 12, lineHeight: 19 },
  contributionBox: { padding: 15, marginTop: 13, borderRadius: 9, backgroundColor: C.surface, gap: 10 },
  amountChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amountChoice: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper },
  amountChoiceSelected: { backgroundColor: C.green, borderColor: C.green },
  amountChoiceText: { color: C.text, fontSize: 12, fontWeight: '600' },
  amountChoiceTextSelected: { color: '#FFFFFF' },
  simulateButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 22, backgroundColor: C.green },
  simulateButtonDisabled: { opacity: 0.55 },
  simulateButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  contributionSuccess: { color: C.green, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  contributionError: { color: '#8F3F4E', fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.72 },
  copy: { color: C.muted, fontSize: 14, marginTop: 8 },
  backButton: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: C.brown, marginTop: 20 },
  backButtonText: { color: C.espresso, fontSize: 12, fontWeight: '700' },
});
