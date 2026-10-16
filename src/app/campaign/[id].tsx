import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { discoveryCampaigns, formatIsoDate, getDeadlineLabel } from '@/data/campaigns';
import { useUtcToday } from '@/hooks/use-utc-today';

const C = {
  paper: '#EEE8DF', white: '#FFFEFA', ink: '#302A25', muted: '#776E65',
  line: '#E8E1D7', brown: '#74563F', brownLight: '#EDE5DA', green: '#536D58',
};

export default function CampaignDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const today = useUtcToday();
  const campaign = discoveryCampaigns.find((item) => item.id === id);

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

  const progress = Math.min(campaign.raised / campaign.goal, 1);
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backLink}>
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

        <View style={styles.fundingCard}>
          <Text style={styles.fundingTitle}>Distribution funding · demo figures</Text>
          <View style={styles.fundingRow}>
            <Text style={styles.raised}>${campaign.raised.toLocaleString()} <Text style={styles.raisedHint}>raised</Text></Text>
            <Text style={styles.goal}>of ${campaign.goal.toLocaleString()} goal</Text>
          </View>
          <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.reach}>Estimated potential reach at goal: ~{campaign.estimatedReachAtGoal.toLocaleString()}</Text>
          <Text style={styles.deadline}>{getDeadlineLabel(campaign.fundingDeadline, today)} · deadline {formatIsoDate(campaign.fundingDeadline)}</Text>
          <Text style={styles.disclaimer}>Illustrative estimate only. Reach is not guaranteed. SIGNAL does not currently run advertising integrations or process contributions.</Text>
        </View>

        <View style={styles.distributionCard}>
          <Text style={styles.distributionLabel}>PLANNED DISTRIBUTION PLATFORM</Text>
          <Text style={styles.platform}>{campaign.platform}</Text>
          <Text style={styles.distributionCopy}>This is the campaign creator’s intended platform. No campaign ads are currently running through SIGNAL.</Text>
        </View>
        <Text style={styles.footer}>Contributions support message distribution and amplification, not a direct donation to the underlying cause.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  content: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 32, maxWidth: 680, width: '100%', alignSelf: 'center' },
  backLink: { alignSelf: 'flex-start', paddingVertical: 10, paddingRight: 12, marginBottom: 9 },
  backLinkText: { color: C.brown, fontSize: 13, fontWeight: '700' },
  cover: { height: 178, alignItems: 'center', justifyContent: 'center', borderRadius: 9, overflow: 'hidden', marginBottom: 18 },
  coverEmblem: { width: 66, height: 66, alignItems: 'center', justifyContent: 'center', borderRadius: 33, backgroundColor: 'rgba(255,254,250,0.7)' },
  coverSymbol: { color: C.brown, fontSize: 38, lineHeight: 42 },
  coverCaption: { position: 'absolute', right: 11, bottom: 10, color: 'rgba(48,42,37,0.55)', fontSize: 8, fontWeight: '700', letterSpacing: 0.8 },
  categoryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 9 },
  category: { color: C.green, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  status: { color: C.brown, backgroundColor: C.brownLight, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5, fontSize: 9, fontWeight: '600', overflow: 'hidden' },
  title: { color: C.ink, fontSize: 28, lineHeight: 34, fontWeight: '600', letterSpacing: -0.5 },
  cause: { color: C.brown, fontSize: 13, fontWeight: '600', marginTop: 5 },
  creator: { color: C.muted, fontSize: 11, marginTop: 8 },
  meta: { color: C.muted, fontSize: 10, marginTop: 5 },
  description: { color: C.ink, fontSize: 14, lineHeight: 22, marginTop: 16 },
  fundingCard: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 9, padding: 16, marginTop: 22 },
  fundingTitle: { color: C.ink, fontSize: 14, fontWeight: '700', marginBottom: 14 },
  fundingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 8 },
  raised: { color: C.ink, fontSize: 16, fontWeight: '700' },
  raisedHint: { color: C.muted, fontSize: 11, fontWeight: '400' },
  goal: { color: C.muted, fontSize: 11 },
  progressTrack: { height: 6, borderRadius: 4, backgroundColor: '#EEE9E0', overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: C.green, borderRadius: 4 },
  reach: { color: C.ink, fontSize: 11, marginTop: 11 },
  deadline: { color: C.brown, fontSize: 11, fontWeight: '700', marginTop: 10 },
  disclaimer: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 7 },
  distributionCard: { borderRadius: 9, backgroundColor: '#E8E1D7', padding: 16, marginTop: 13 },
  distributionLabel: { color: C.brown, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  platform: { color: C.ink, fontSize: 17, fontWeight: '700', marginTop: 7 },
  distributionCopy: { color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 5 },
  footer: { color: C.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 18 },
  notFound: { flex: 1, justifyContent: 'center', padding: 24 },
  copy: { color: C.muted, fontSize: 14, marginTop: 8 },
  backButton: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: C.brown, marginTop: 20 },
  backButtonText: { color: C.white, fontSize: 12, fontWeight: '700' },
});
