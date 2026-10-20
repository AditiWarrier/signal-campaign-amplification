import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/auth-context';
import { HomeHeader } from '@/components/home/home-header';
import { HomeHero } from '@/components/home/home-hero';
import { HowItWorks } from '@/components/home/how-it-works';
import { ImportantMessages } from '@/components/home/important-messages';
import { MonthlyWins } from '@/components/home/monthly-wins';
import { PEOPLE_SECTION_YELLOW, PeoplePanel } from '@/components/home/people-panel';
import { ReachEstimate } from '@/components/home/reach-estimate';
import { WorldCampaigns } from '@/components/home/world-campaigns';
import { Signal, SignalFonts } from '@/constants/theme';
import { useWebScrollDiagnostics } from '@/hooks/use-web-scroll-diagnostics';
import { readCampaignDemoContributions } from '@/data/demo-contributions';
import { campaignFundingMinorForContribution, DEMO_REACH_PER_RUPEE } from '@/data/demo-reach';
import { homeCampaigns, homePeople } from '@/data/home-demo';

const CONTENT_MAX_WIDTH = 560;
const GUTTER = 20;

export default function HomeScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const { session } = useAuth();
  const [demoTotals, setDemoTotals] = useState<Record<string, { amountMinor: number; count: number }>>({});
  const [focusedFooterLink, setFocusedFooterLink] = useState<string | null>(null);
  const { width: windowWidth } = useWindowDimensions();
  useWebScrollDiagnostics(scrollRef, 'home');
  useFocusEffect(useCallback(() => {
    let active = true;
    void Promise.all(homeCampaigns.map(async (campaign) => {
      try {
        const records = await readCampaignDemoContributions(campaign.id);
        const amountMinor = records.reduce((total, record) => Math.min(Number.MAX_SAFE_INTEGER, total + campaignFundingMinorForContribution(record)), 0);
        return [campaign.id, { amountMinor, count: records.length }] as const;
      } catch { return [campaign.id, { amountMinor: 0, count: 0 }] as const; }
    })).then((totals) => { if (active) setDemoTotals(Object.fromEntries(totals)); });
    return () => { active = false; };
  }, []));

  const columnWidth = Math.min(windowWidth, CONTENT_MAX_WIDTH);
  const contentWidth = columnWidth - GUTTER * 2;
  const wideFooter = windowWidth >= 720;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView ref={scrollRef} style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator>
        <View style={s.column}>
          <HomeHeader />
          <HomeHero width={contentWidth} />
          <ImportantMessages />
          <ReachEstimate reachPerDollar={DEMO_REACH_PER_RUPEE} />
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
        </View>
        <View style={s.formalFooter}>
          <View style={s.formalFooterContent}>
            <Text style={s.formalFooterWordmark}>SIGNAL</Text>
            <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/information', params: { section: 'about' } } as never)} onFocus={() => setFocusedFooterLink('About')} onBlur={() => setFocusedFooterLink((current) => current === 'About' ? null : current)} hitSlop={5} style={[s.formalFooterAboutHit, focusedFooterLink === 'About' && s.formalFooterLinkFocus]}>
              <Text style={[s.formalFooterAbout, s.formalFooterAboutLink, focusedFooterLink === 'About' && s.formalFooterLinkFocused]}>About</Text>
            </Pressable>
            <Text style={s.formalFooterDescription}>A little about SIGNAL and the work we do.</Text>
            <View style={s.formalFooterGroups}>
              {footerGroups.map((group) => {
                const isHowItWorks = group.title === 'HOW IT WORKS';
                const headingFocused = focusedFooterLink === group.title;
                return <View key={group.title} style={[s.formalFooterGroup, wideFooter ? s.formalFooterGroupWide : s.formalFooterGroupMobile]}>
                {isHowItWorks ? <Pressable accessibilityRole="link" onPress={() => router.push('/how-it-works' as never)} onFocus={() => setFocusedFooterLink(group.title)} onBlur={() => setFocusedFooterLink((current) => current === group.title ? null : current)} hitSlop={5} style={[s.formalFooterLinkCell, headingFocused && s.formalFooterLinkFocus]}>
                  <Text style={[s.formalFooterGroupTitle, s.formalFooterLink, headingFocused && s.formalFooterLinkFocused]}>{group.title}</Text>
                </Pressable> : <Text style={s.formalFooterGroupTitle}>{group.title}</Text>}
                {group.links.map((item) => {
                  const isPlaceholder = !item.section && !item.route;
                  const focused = focusedFooterLink === item.label;
                  const label = <Text style={[s.formalFooterLink, isPlaceholder && s.formalFooterPlaceholder, focused && s.formalFooterLinkFocused]}>{item.label}</Text>;
                  if (!item.section && !item.route) {
                    return <View key={item.label} style={s.formalFooterLinkCell}>{label}</View>;
                  }
                  return <Pressable key={item.label} accessibilityRole="link" onPress={() => {
                    if (item.section) {
                      router.push({ pathname: '/information', params: { section: item.section } } as never);
                    } else if (item.route === '/create') {
                      router.push(session ? '/create' : '/login');
                    } else if (item.route === '/how-it-works') {
                      router.push({ pathname: '/how-it-works', params: item.anchor ? { section: item.anchor } : {} } as never);
                    } else if (item.route) {
                      router.push(item.route);
                    }
                  }} onFocus={() => setFocusedFooterLink(item.label)} onBlur={() => setFocusedFooterLink((current) => current === item.label ? null : current)} hitSlop={5} style={[s.formalFooterLinkCell, focused && s.formalFooterLinkFocus]}>{label}</Pressable>;
                })}
              </View>;
              })}
            </View>
          </View>
        </View>
        <View style={s.column}>
          <Text style={s.footer}>Small signals. Wider circles.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

type FooterGroupLink = {
  label: string;
  section?: string;
  route?: '/explore' | '/create' | '/how-it-works';
  anchor?: string;
};

const footerGroups: { title: string; links: FooterGroupLink[] }[] = [
  { title: 'PLATFORM', links: [{ label: 'Explore Campaigns', route: '/explore' }, { label: 'Start a Campaign', route: '/create' }] },
  { title: 'HOW IT WORKS', links: [{ label: 'Review Process', route: '/how-it-works', anchor: 'review-process' }, { label: 'Evaluation', route: '/how-it-works', anchor: 'evaluation' }, { label: 'FAQ', route: '/how-it-works', anchor: 'faq' }] },
  { title: 'LEGAL', links: [{ label: 'Terms', section: 'terms' }, { label: 'Privacy', section: 'privacy' }, { label: 'Contact', section: 'contact' }] },
  { title: 'SUPPORT', links: [{ label: 'Partners', section: 'partners' }, { label: 'Help', section: 'help' }, { label: 'Community Guidelines', section: 'community-guidelines' }] },
];

const s = StyleSheet.create({
  safe: { flex: 1, minHeight: 0, backgroundColor: Signal.paper },
  scroll: { flex: 1, minHeight: 0, backgroundColor: Signal.paper },
  content: { paddingBottom: 120, width: '100%' },
  column: { paddingHorizontal: GUTTER, maxWidth: CONTENT_MAX_WIDTH, width: '100%', alignSelf: 'center' },
  footer: { color: Signal.ink, fontFamily: SignalFonts.display, fontStyle: 'italic', textAlign: 'center', fontSize: 17, marginTop: 20 },
  formalFooter: { width: '100%', backgroundColor: PEOPLE_SECTION_YELLOW, marginTop: 56, paddingHorizontal: GUTTER, paddingVertical: 18 },
  formalFooterContent: { maxWidth: CONTENT_MAX_WIDTH, width: '100%', alignSelf: 'center' },
  formalFooterWordmark: { color: Signal.ink, fontFamily: SignalFonts.sans, fontSize: 20, lineHeight: 24, fontWeight: '900', letterSpacing: 5 },
  formalFooterAboutHit: { alignSelf: 'flex-start', marginTop: 9 },
  formalFooterAbout: { color: Signal.ink, fontFamily: SignalFonts.display, fontSize: 20, lineHeight: 26 },
  formalFooterAboutLink: { fontStyle: 'italic', textDecorationLine: 'underline' },
  formalFooterDescription: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, fontSize: 12, lineHeight: 18, marginTop: 2 },
  formalFooterGroups: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12, marginTop: 16 },
  formalFooterGroup: { minWidth: 0, gap: 2, paddingRight: 12 },
  formalFooterGroupWide: { width: '25%' },
  formalFooterGroupMobile: { width: '50%' },
  formalFooterGroupTitle: { color: Signal.forest, fontFamily: SignalFonts.sans, fontSize: 10, lineHeight: 15, fontWeight: '700', letterSpacing: 0.7, marginBottom: 3 },
  formalFooterLinkCell: { minHeight: 27, justifyContent: 'center', alignSelf: 'stretch' },
  formalFooterLink: { color: Signal.ink, fontFamily: SignalFonts.sans, fontSize: 12, lineHeight: 17, fontWeight: '600', fontStyle: 'italic', textDecorationLine: 'underline' },
  formalFooterPlaceholder: { color: Signal.inkSoft, fontStyle: 'normal', textDecorationLine: 'none' },
  formalFooterLinkFocused: { fontWeight: '700' },
  formalFooterLinkFocus: { borderWidth: 1, borderColor: Signal.ink, borderRadius: 2, paddingHorizontal: 4 },
});
