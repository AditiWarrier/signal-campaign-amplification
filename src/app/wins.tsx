import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Signal, SignalFonts, SignalType } from '@/constants/theme';
import { discoveryCampaigns } from '@/data/campaigns';
import { formatInrMinor, parseUsdMinor } from '@/data/funding';

const completedCampaigns = discoveryCampaigns.filter((campaign) => campaign.status === 'completed');

export default function WinsScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
          <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.backButton}>
            <Text style={styles.backText}>‹  Home</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>Discover the Wins</Text>
          <Text style={styles.intro}>Campaigns listed as completed in the SIGNAL catalogue.</Text>

          {completedCampaigns.length ? completedCampaigns.map((campaign) => (
            <Pressable
              key={campaign.id}
              accessibilityRole="button"
              accessibilityLabel={`Open completed campaign: ${campaign.title}`}
              onPress={() => router.push({ pathname: '/campaign/[id]', params: { id: campaign.id } } as never)}
              style={({ pressed }) => [styles.campaign, pressed && styles.pressed]}>
              <Image source={campaign.image} style={styles.cover} contentFit="cover" accessibilityLabel={`Cover image for ${campaign.title}`} />
              <View style={styles.campaignBody}>
                <Text style={styles.category}>{campaign.category.toUpperCase()}</Text>
                <Text style={styles.campaignTitle}>{campaign.title}</Text>
                <Text style={styles.creator}>By {campaign.creator}</Text>
                <Text style={styles.story}>{campaign.description}</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.completed}>Successfully completed</Text>
                  <Text style={styles.goal}>{formatInrMinor(parseUsdMinor(campaign.goal))} goal</Text>
                </View>
                <Text style={styles.openLink}>Read the campaign story  →</Text>
              </View>
            </Pressable>
          )) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>✦</Text>
              <Text style={styles.emptyTitle}>No completed campaigns yet</Text>
              <Text style={styles.story}>Successful campaigns will appear here when they are listed as completed.</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Signal.paper },
  scrollContent: { flexGrow: 1, paddingBottom: 120 },
  container: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 8, gap: 16 },
  backButton: { minHeight: 42, justifyContent: 'center', alignSelf: 'flex-start', paddingRight: 12 },
  backText: { color: Signal.forest, fontFamily: SignalFonts.sans, fontSize: 14, fontWeight: '700' },
  title: { color: Signal.ink, fontFamily: SignalFonts.display, ...SignalType.sectionTitle },
  intro: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, ...SignalType.body, marginTop: -9, marginBottom: 2 },
  campaign: { overflow: 'hidden', backgroundColor: Signal.paper, borderWidth: StyleSheet.hairlineWidth, borderColor: Signal.hairline, borderRadius: 8 },
  cover: { width: '100%', aspectRatio: 16 / 9, backgroundColor: Signal.paperDeep },
  campaignBody: { padding: 16, gap: 7 },
  category: { color: Signal.forest, fontFamily: SignalFonts.sans, fontSize: 10, letterSpacing: 1.1, fontWeight: '700' },
  campaignTitle: { color: Signal.ink, fontFamily: SignalFonts.display, fontSize: 21, lineHeight: 27 },
  creator: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, fontSize: 12, lineHeight: 17 },
  story: { color: Signal.ink, fontFamily: SignalFonts.sans, ...SignalType.body },
  detailRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, paddingTop: 5 },
  completed: { color: Signal.forest, fontFamily: SignalFonts.sans, fontSize: 12, fontWeight: '700' },
  goal: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, fontSize: 12 },
  openLink: { color: Signal.forest, fontFamily: SignalFonts.sans, fontSize: 13, fontWeight: '700', marginTop: 4 },
  emptyState: { alignItems: 'center', gap: 10, padding: 28, backgroundColor: Signal.paperDeep, borderRadius: 8 },
  emptyIcon: { color: Signal.forest, fontSize: 26 },
  emptyTitle: { color: Signal.ink, fontFamily: SignalFonts.display, fontSize: 20 },
  pressed: { opacity: 0.76 },
});
