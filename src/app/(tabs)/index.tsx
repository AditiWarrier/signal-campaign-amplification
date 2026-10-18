import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/auth-context';
import { HomeHeader } from '@/components/home/home-header';
import { HomeHero } from '@/components/home/home-hero';
import { HowItWorks } from '@/components/home/how-it-works';
import { ImportantMessages } from '@/components/home/important-messages';
import { MonthlyWins } from '@/components/home/monthly-wins';
import { PeoplePanel } from '@/components/home/people-panel';
import { ReachEstimate } from '@/components/home/reach-estimate';
import { WorldCampaigns } from '@/components/home/world-campaigns';
import { Signal, SignalFonts } from '@/constants/theme';
import { useWebScrollDiagnostics } from '@/hooks/use-web-scroll-diagnostics';
import { readCampaignDemoContributions } from '@/data/demo-contributions';
import { homeCampaigns, homePeople } from '@/data/home-demo';

const DEMO_REACH_PER_DOLLAR = 12; // Configurable illustrative assumption only.
const CONTENT_MAX_WIDTH = 560;
const GUTTER = 20;

export default function HomeScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const { session } = useAuth();
  const [demoTotals, setDemoTotals] = useState<Record<string, { amountMinor: number; count: number }>>({});
  const { width: windowWidth } = useWindowDimensions();
  useWebScrollDiagnostics(scrollRef, 'home');
  useFocusEffect(useCallback(() => {
    let active = true;
    void Promise.all(homeCampaigns.map(async (campaign) => {
      try {
        const records = await readCampaignDemoContributions(campaign.id);
        const amountMinor = records.reduce((total, record) => Math.min(Number.MAX_SAFE_INTEGER, total + record.amountMinor), 0);
        return [campaign.id, { amountMinor, count: records.length }] as const;
      } catch { return [campaign.id, { amountMinor: 0, count: 0 }] as const; }
    })).then((totals) => { if (active) setDemoTotals(Object.fromEntries(totals)); });
    return () => { active = false; };
  }, []));

  const columnWidth = Math.min(windowWidth, CONTENT_MAX_WIDTH);
  const contentWidth = columnWidth - GUTTER * 2;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView ref={scrollRef} style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator>
        <View style={s.column}>
          <HomeHeader />
          <HomeHero width={contentWidth} />
          <ImportantMessages />
          <ReachEstimate reachPerDollar={DEMO_REACH_PER_DOLLAR} />
        </View>

        <WorldCampaigns
          campaigns={homeCampaigns}
          demoTotals={demoTotals}
          signedIn={Boolean(session)}
          windowWidth={windowWidth}
          columnWidth={columnWidth}
          gutter={GUTTER}
        />

        <View style={s.column}>
          <HowItWorks />
        </View>

        <PeoplePanel people={homePeople} />

        <View style={s.column}>
          <MonthlyWins />
          <Text style={s.footer}>Small signals. Wider circles.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, minHeight: 0, backgroundColor: Signal.paper },
  scroll: { flex: 1, minHeight: 0, backgroundColor: Signal.paper },
  content: { paddingBottom: 128, width: '100%' },
  column: { paddingHorizontal: GUTTER, maxWidth: CONTENT_MAX_WIDTH, width: '100%', alignSelf: 'center' },
  footer: { color: Signal.ink, fontFamily: SignalFonts.display, fontStyle: 'italic', textAlign: 'center', fontSize: 17, marginTop: 40 },
});
