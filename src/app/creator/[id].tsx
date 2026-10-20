import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HomeHeader } from '@/components/home/home-header';
import { MaxContentWidth, Signal, SignalFonts, SignalType } from '@/constants/theme';
import { discoveryCampaigns } from '@/data/campaigns';
import { readCampaignDemoContributions } from '@/data/demo-contributions';
import { campaignFundingMinorForContribution } from '@/data/demo-reach';
import { getCreatorCampaigns, getCreatorProfile } from '@/data/creator-profiles';
import { calculateFundingProgress, formatInrMinor, parseUsdMinor } from '@/data/funding';

type DemoTotals = Record<string, number>;

function CreatorCampaignCard({ campaign, demoRaisedMinor }: {
  campaign: (typeof discoveryCampaigns)[number];
  demoRaisedMinor: number;
}) {
  const raisedMinor = Math.min(Number.MAX_SAFE_INTEGER, parseUsdMinor(campaign.raised) + demoRaisedMinor);
  const progress = calculateFundingProgress(parseUsdMinor(campaign.goal), raisedMinor);
  const percent = progress.percentage === null
    ? 0
    : Math.round(progress.percentage);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open campaign: ${campaign.title}`}
      onPress={() => router.push({ pathname: '/campaign/[id]', params: { id: campaign.id } } as never)}
      style={({ pressed }) => [styles.campaignCard, pressed && styles.pressed]}>
      <Image
        source={campaign.image}
        style={styles.campaignImage}
        contentFit="cover"
        accessibilityLabel={`Cover image for ${campaign.title}`}
      />
      <View style={styles.campaignBody}>
        <Text style={styles.campaignCategory}>{campaign.category.toUpperCase()}</Text>
        <Text style={styles.campaignTitle}>{campaign.title}</Text>
        <Text style={styles.campaignCreator}>By {campaign.creator}</Text>
        <View style={styles.fundingRow}>
          <Text style={styles.fundingRaised}>{formatInrMinor(raisedMinor)}</Text>
          <Text style={styles.fundingGoal}>of {formatInrMinor(parseUsdMinor(campaign.goal))}</Text>
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={`${percent}% funded`}
          accessibilityValue={{ min: 0, max: 100, now: Math.max(0, Math.min(percent, 100)) }}
          style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress.barPercentage}%` }]} />
        </View>
        <View style={styles.campaignMeta}>
          <Text style={[styles.campaignStatus, campaign.status === 'completed' && styles.campaignStatusCompleted]}>
            {campaign.status === 'completed' ? 'Successfully completed · goal reached' : campaign.status}
          </Text>
          <Text style={styles.campaignPercent}>{percent}% funded</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function CreatorProfileScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const creatorId = Array.isArray(params.id) ? params.id[0] : params.id;
  const profile = getCreatorProfile(creatorId);
  const campaigns = useMemo(() => profile ? getCreatorCampaigns(profile.id) : [], [profile]);
  const [demoTotals, setDemoTotals] = useState<DemoTotals>({});

  useFocusEffect(useCallback(() => {
    let focused = true;
    void Promise.all(campaigns.map(async (campaign) => {
      try {
        const records = await readCampaignDemoContributions(campaign.id);
        return [campaign.id, records.reduce((sum, record) => Math.min(Number.MAX_SAFE_INTEGER, sum + campaignFundingMinorForContribution(record)), 0)] as const;
      } catch {
        return [campaign.id, 0] as const;
      }
    })).then((entries) => {
      if (focused) setDemoTotals(Object.fromEntries(entries));
    });
    return () => { focused = false; };
  }, [campaigns]));

  if (!profile) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.container}>
          <View style={styles.topBar}>
            <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={styles.backButton}>
              <Text style={styles.backText}>← Home</Text>
            </Pressable>
            <View style={styles.menuHeader}><HomeHeader menuOnly /></View>
          </View>
          <View style={styles.notFound}>
            <Text accessibilityRole="header" style={styles.notFoundTitle}>Creator profile unavailable</Text>
            <Text style={styles.bodyCopy}>This profile is not listed in the SIGNAL demo.</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const ongoingCampaigns = campaigns.filter((campaign) =>
    campaign.status === 'Building support' || campaign.status === 'Ready for amplification');
  const completedCampaigns = campaigns.filter((campaign) => campaign.status === 'completed');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
          <View style={styles.topBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
              style={styles.backButton}>
              <Text style={styles.backText}>← Back</Text>
            </Pressable>
            <View style={styles.menuHeader}><HomeHeader menuOnly /></View>
          </View>

          <View style={styles.profileHero}>
            <Image
              source={profile.image}
              style={styles.portrait}
              contentFit="cover"
              accessibilityLabel={`Profile portrait for ${profile.name}`}
            />
            <View style={styles.identity}>
              <Text accessibilityRole="header" style={styles.name}>{profile.name}</Text>
              <Text style={styles.role}>{profile.role}</Text>
              <Text style={styles.country}>{profile.country}</Text>
            </View>
          </View>
          <Text style={styles.introduction}>{profile.introduction}</Text>
          <Text style={styles.disclosure}>Illustrative demo profile. Creator identities, campaign outcomes, and funding figures are sample data, not independently verified. Contact details are non-operational placeholders.</Text>

          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>About Me</Text>
            {profile.aboutMe.map((paragraph) => <Text key={paragraph} style={styles.aboutParagraph}>{paragraph}</Text>)}
          </View>

          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Contact</Text>
            <View style={styles.contactBlock}>
              <View style={styles.contactItem}>
                <Text style={styles.contactLabel}>Demo email</Text>
                <Text selectable style={styles.contactValue}>{profile.demoEmail}</Text>
              </View>
              <View style={styles.contactItem}>
                <Text style={styles.contactLabel}>Demo phone · non-operational</Text>
                <Text selectable style={styles.contactValue}>{profile.demoPhone}</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Ongoing Campaigns</Text>
            {ongoingCampaigns.length ? ongoingCampaigns.map((campaign) => (
              <CreatorCampaignCard key={campaign.id} campaign={campaign} demoRaisedMinor={demoTotals[campaign.id] ?? 0} />
            )) : <Text style={styles.emptyState}>No ongoing campaigns are currently listed.</Text>}
          </View>

          <View style={styles.section}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>Successfully Completed</Text>
            {completedCampaigns.length ? completedCampaigns.map((campaign) => (
              <CreatorCampaignCard key={campaign.id} campaign={campaign} demoRaisedMinor={demoTotals[campaign.id] ?? 0} />
            )) : <Text style={styles.emptyState}>No completed campaigns are currently listed.</Text>}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Signal.paper },
  scrollContent: { flexGrow: 1, paddingBottom: 48 },
  container: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: 22 },
  topBar: { minHeight: 56, flexDirection: 'row', alignItems: 'center' },
  backButton: { minHeight: 44, justifyContent: 'center', paddingRight: 12 },
  backText: { color: Signal.forest, fontFamily: SignalFonts.sans, fontSize: 14, fontWeight: '700' },
  menuHeader: { flex: 1 },
  profileHero: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingTop: 26 },
  portrait: { width: 116, height: 116, borderRadius: 58, backgroundColor: Signal.paperDeep },
  identity: { flex: 1 },
  name: { color: Signal.ink, fontFamily: SignalFonts.display, fontSize: 31, lineHeight: 38 },
  role: { color: Signal.forest, fontFamily: SignalFonts.sans, fontSize: 15, lineHeight: 21, fontWeight: '700', marginTop: 5 },
  country: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, fontSize: 14, lineHeight: 20, marginTop: 2 },
  introduction: { color: Signal.ink, fontFamily: SignalFonts.sans, fontSize: 16, lineHeight: 25, marginTop: 24 },
  disclosure: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, fontSize: 12, lineHeight: 18, borderLeftWidth: 2, borderLeftColor: Signal.maroon, paddingLeft: 12, marginTop: 14 },
  section: { marginTop: 34, paddingTop: 22, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Signal.hairline, gap: 14 },
  sectionTitle: { color: Signal.ink, fontFamily: SignalFonts.display, ...SignalType.sectionTitle, marginBottom: 2 },
  aboutParagraph: { color: Signal.ink, fontFamily: SignalFonts.sans, ...SignalType.body },
  contactBlock: { backgroundColor: '#FBF9F3', borderWidth: StyleSheet.hairlineWidth, borderColor: Signal.hairline, borderRadius: 4, paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  contactItem: { gap: 3 },
  contactLabel: { color: Signal.forest, fontFamily: SignalFonts.sans, fontSize: 11, lineHeight: 16, letterSpacing: 0.5, fontWeight: '700' },
  contactValue: { color: Signal.ink, fontFamily: SignalFonts.sans, fontSize: 14, lineHeight: 20 },
  emptyState: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, ...SignalType.small, backgroundColor: Signal.paperDeep, padding: 16, borderRadius: 4 },
  campaignCard: { flexDirection: 'row', overflow: 'hidden', backgroundColor: '#FBF9F3', borderWidth: StyleSheet.hairlineWidth, borderColor: Signal.hairline, borderRadius: 4, minHeight: 136 },
  campaignImage: { width: 112, minHeight: 136, backgroundColor: Signal.paperDeep },
  campaignBody: { flex: 1, minWidth: 0, paddingHorizontal: 14, paddingVertical: 12 },
  campaignCategory: { color: Signal.forest, fontFamily: SignalFonts.sans, fontSize: 10, lineHeight: 14, letterSpacing: 1.1, fontWeight: '700' },
  campaignTitle: { color: Signal.ink, fontFamily: SignalFonts.display, fontSize: 18, lineHeight: 22, marginTop: 4 },
  campaignCreator: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, fontSize: 12, lineHeight: 16, marginTop: 3 },
  fundingRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 9 },
  fundingRaised: { color: Signal.ink, fontFamily: SignalFonts.sans, fontSize: 12, fontWeight: '700' },
  fundingGoal: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, fontSize: 11 },
  progressTrack: { height: 4, overflow: 'hidden', borderRadius: 2, backgroundColor: Signal.paperDeep, marginTop: 6 },
  progressFill: { height: '100%', backgroundColor: Signal.forest },
  campaignMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, marginTop: 6 },
  campaignStatus: { flex: 1, color: Signal.inkSoft, fontFamily: SignalFonts.sans, fontSize: 10, lineHeight: 14 },
  campaignStatusCompleted: { color: Signal.forest, fontWeight: '700' },
  campaignPercent: { color: Signal.ink, fontFamily: SignalFonts.sans, fontSize: 10, lineHeight: 14, fontWeight: '700' },
  pressed: { opacity: 0.72 },
  notFound: { paddingTop: 36, gap: 12 },
  notFoundTitle: { color: Signal.ink, fontFamily: SignalFonts.display, fontSize: 26, lineHeight: 32 },
  bodyCopy: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, ...SignalType.body },
});
