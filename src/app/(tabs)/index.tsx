import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/auth-context';
import { HomeHeader } from '@/components/home/home-header';
import { HomeHero } from '@/components/home/home-hero';
import { ImportantMessages } from '@/components/home/important-messages';
import { ReachEstimate } from '@/components/home/reach-estimate';
import { Signal, SignalFonts, SignalType } from '@/constants/theme';
import { useWebScrollDiagnostics } from '@/hooks/use-web-scroll-diagnostics';
import { readCampaignDemoContributions } from '@/data/demo-contributions';
import { parseUsdMinor } from '@/data/funding';

const DEMO_REACH_PER_DOLLAR = 12; // Configurable illustrative assumption only.
const CONTENT_MAX_WIDTH = 560;
const GUTTER = 20;

type Campaign = {
  id: string; category: string; title: string; creator: string; summary: string;
  raised: number; goal: number; color: string; reach: number;
};

const campaigns: Campaign[] = [
  { id: 'neighbors-share-fresh-food', category: 'Community · Mutual aid', title: 'Neighbors share fresh food', creator: 'Eastside Pantry Project (fictional)', summary: 'A sample community pantry is raising awareness of its weekly produce exchange and volunteer sign-up days.', raised: 1840, goal: 4000, color: Signal.forest, reach: 48000 },
  { id: 'creekside-native-plants', category: 'Climate · Local action', title: 'Bring Creekside back to life', creator: 'Creekside Neighbors (fictional group)', summary: 'A volunteer group is organizing a native planting day and sharing simple ways nearby residents can care for the creek.', raised: 2675, goal: 5000, color: Signal.lake, reach: 60000 },
  { id: 'stories-from-main-street', category: 'Arts · Independent media', title: 'Stories from Main Street', creator: 'Open Frame Studio (fictional collective)', summary: 'An independent fictional arts collective is preparing a short film about the people who make a neighborhood feel like home.', raised: 920, goal: 3000, color: Signal.forestDeep, reach: 36000 },
];

type ImpactPerson = { name: string; cause: string; description: string };

const impactPeople: ImpactPerson[] = [
  { name: 'Amara Lewis', cause: 'Neighborhood food access', description: 'Bringing more neighbors together to make fresh food easier to find and share.' },
  { name: 'Leo Nakamura', cause: 'Urban creek restoration', description: 'Helping local volunteers restore a healthier home for wildlife along the creek.' },
  { name: 'Sofia Reyes', cause: 'Independent local stories', description: 'Making a short film that celebrates the people who give a neighborhood its character.' },
];

function SectionTitle({ title, action }: { title: string; action?: () => void }) {
  return (
    <View style={s.sectionHead}>
      <Text accessibilityRole="header" style={s.sectionTitle}>{title}</Text>
      {action && (
        <Pressable accessibilityRole="link" onPress={action} hitSlop={8} style={s.textLinkHit}>
          <Text style={s.textLink}>{'See all →'}</Text>
        </Pressable>
      )}
    </View>
  );
}

function CampaignCard({ campaign, demoRaisedMinor, demoContributionCount, signedIn }: { campaign: Campaign; demoRaisedMinor: number; demoContributionCount: number; signedIn: boolean }) {
  const raisedMinor = Math.min(Number.MAX_SAFE_INTEGER, parseUsdMinor(campaign.raised) + demoRaisedMinor);
  const goalMinor = parseUsdMinor(campaign.goal);
  const raised = raisedMinor / 100;
  const progress = goalMinor > 0 ? Math.min(raisedMinor / goalMinor, 1) : 0;
  return (
    <View style={s.card}>
      <View style={[s.cover, { backgroundColor: campaign.color }]}>
        <Text style={s.coverCategory}>{campaign.category.toUpperCase()}</Text>
      </View>
      <View style={s.cardBody}>
        <Text style={s.campaignTitle}>{campaign.title}</Text>
        <Text style={s.creator}>By {campaign.creator}</Text>
        <Text style={s.summary}>{campaign.summary}</Text>
        <View style={s.moneyRow}>
          <Text style={s.money}>${raised.toLocaleString('en-US', { maximumFractionDigits: 2 })} <Text style={s.mutedInline}>demo total</Text></Text>
          <Text style={s.goal}>of ${campaign.goal.toLocaleString()}</Text>
        </View>
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} style={s.progressTrack}>
          <View style={[s.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={s.meta}>{demoContributionCount} simulated demo {demoContributionCount === 1 ? 'contribution' : 'contributions'} · no payments</Text>
        <Text style={s.meta}>Estimated reach at goal <Text style={s.metaStrong}>~{campaign.reach.toLocaleString()}</Text></Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Back this Campaign: ${campaign.title}. Demo contribution only.`}
          accessibilityHint={signedIn ? undefined : 'Sign in to back this campaign'}
          style={({ pressed }) => [s.cardButton, pressed && s.pressed]}
          onPress={() => (signedIn
            ? router.push({ pathname: '/campaign/[id]', params: { id: campaign.id } } as never)
            : router.push('/login'))}>
          <Text style={s.cardButtonText}>Back this Campaign</Text>
          <Text style={s.cardButtonText}>{'→'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ImpactPersonCard({ person }: { person: ImpactPerson }) {
  const initials = person.name.split(' ').map((part) => part[0]).join('');
  return (
    <View style={s.personCard}>
      <View style={s.portrait} accessibilityLabel={`Placeholder portrait for fictional demo profile ${person.name}`}>
        <Text style={s.portraitText}>{initials}</Text>
      </View>
      <Text style={s.personName}>{person.name}</Text>
      <Text style={s.personCause}>{person.cause}</Text>
      <Text style={s.personDescription}>{person.description}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const { session } = useAuth();
  const [demoTotals, setDemoTotals] = useState<Record<string, { amountMinor: number; count: number }>>({});
  const { width: windowWidth } = useWindowDimensions();
  useWebScrollDiagnostics(scrollRef, 'home');
  useFocusEffect(useCallback(() => {
    let active = true;
    void Promise.all(campaigns.map(async (campaign) => {
      try {
        const records = await readCampaignDemoContributions(campaign.id);
        const amountMinor = records.reduce((total, record) => Math.min(Number.MAX_SAFE_INTEGER, total + record.amountMinor), 0);
        return [campaign.id, { amountMinor, count: records.length }] as const;
      } catch { return [campaign.id, { amountMinor: 0, count: 0 }] as const; }
    })).then((totals) => { if (active) setDemoTotals(Object.fromEntries(totals)); });
    return () => { active = false; };
  }, []));

  const contentWidth = Math.min(windowWidth, CONTENT_MAX_WIDTH) - GUTTER * 2;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView ref={scrollRef} style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator>
        <HomeHeader />
        <HomeHero width={contentWidth} />
        <ImportantMessages />
        <ReachEstimate reachPerDollar={DEMO_REACH_PER_DOLLAR} />

        <View style={s.section}>
          <SectionTitle title="Campaigns Around the World" action={() => router.push('/explore')} />
          <View style={s.feed}>
            {campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                signedIn={Boolean(session)}
                demoRaisedMinor={demoTotals[campaign.id]?.amountMinor ?? 0}
                demoContributionCount={demoTotals[campaign.id]?.count ?? 0}
              />
            ))}
          </View>
        </View>

        <View style={s.section}>
          <SectionTitle title="People Who Actually Make an Impact" />
          <Text style={s.note}>Fictional demo profiles</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.peopleRow} style={s.peopleScroll}>
            {impactPeople.map((person) => <ImpactPersonCard key={person.name} person={person} />)}
          </ScrollView>
        </View>

        <View style={s.section}>
          <SectionTitle title="How It Works" />
          {[
            ['01', 'Create', 'Tell the story, set a goal, and show what wider reach could mean.'],
            ['02', 'Review', 'We review every campaign for clarity, safety, and community fit.'],
            ['03', 'Amplify', 'When a campaign is ready, supporters help its message travel further.'],
          ].map(([number, title, detail], index) => (
            <View key={number} style={[s.step, index === 0 && s.stepFirst]}>
              <Text style={s.stepNumber}>{number}</Text>
              <View style={s.stepText}>
                <Text style={s.stepTitle}>{title}</Text>
                <Text style={s.stepCopy}>{detail}</Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={s.footer}>Small signals. Wider circles.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, minHeight: 0, backgroundColor: Signal.paper },
  scroll: { flex: 1, minHeight: 0, backgroundColor: Signal.paper },
  content: { paddingHorizontal: GUTTER, paddingBottom: 128, maxWidth: CONTENT_MAX_WIDTH, width: '100%', alignSelf: 'center' },
  pressed: { opacity: 0.7 },

  section: { paddingTop: 56 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 18 },
  sectionTitle: { color: Signal.ink, fontFamily: SignalFonts.display, ...SignalType.sectionTitle, flexShrink: 1 },
  textLinkHit: { minHeight: 44, justifyContent: 'flex-end' },
  textLink: { color: Signal.lake, fontFamily: SignalFonts.sans, fontSize: 15, fontWeight: '700', paddingBottom: 4 },
  note: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, ...SignalType.small, marginTop: -10, marginBottom: 16 },

  feed: { gap: 20 },
  card: { borderRadius: 4, overflow: 'hidden', backgroundColor: Signal.paperDeep },
  cover: { height: 120, padding: 16, justifyContent: 'flex-end' },
  coverCategory: { color: Signal.onDark, fontFamily: SignalFonts.sans, ...SignalType.eyebrow },
  cardBody: { padding: 18 },
  campaignTitle: { color: Signal.ink, fontFamily: SignalFonts.display, fontSize: 24, lineHeight: 30 },
  creator: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, fontSize: 14, lineHeight: 20, marginTop: 4 },
  summary: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, ...SignalType.body, marginTop: 12, marginBottom: 18 },
  moneyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  money: { color: Signal.ink, fontFamily: SignalFonts.sans, fontSize: 17, fontWeight: '700' },
  mutedInline: { color: Signal.inkSoft, fontSize: 13, fontWeight: '400' },
  goal: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, fontSize: 14 },
  progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: Signal.hairline },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: Signal.forest },
  meta: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, fontSize: 13, lineHeight: 19, marginTop: 8 },
  metaStrong: { color: Signal.ink, fontWeight: '700' },
  cardButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 48, borderWidth: 1, borderColor: Signal.ink, borderRadius: 24, marginTop: 18, gap: 8 },
  cardButtonText: { color: Signal.ink, fontFamily: SignalFonts.sans, fontSize: 15, fontWeight: '700' },

  peopleScroll: { marginHorizontal: -GUTTER },
  peopleRow: { gap: 16, paddingHorizontal: GUTTER },
  personCard: { width: 200, paddingTop: 4 },
  portrait: { width: 88, height: 88, borderRadius: 44, backgroundColor: Signal.paperDeep, borderWidth: 1, borderColor: Signal.hairline, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  portraitText: { color: Signal.forest, fontFamily: SignalFonts.display, fontSize: 28 },
  personName: { color: Signal.ink, fontFamily: SignalFonts.sans, fontSize: 17, fontWeight: '700' },
  personCause: { color: Signal.forest, fontFamily: SignalFonts.sans, fontSize: 14, fontWeight: '600', marginTop: 4 },
  personDescription: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, ...SignalType.small, marginTop: 6 },

  step: { flexDirection: 'row', gap: 16, paddingVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Signal.ink },
  stepFirst: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Signal.ink },
  stepNumber: { color: Signal.lake, fontFamily: SignalFonts.display, fontSize: 20, lineHeight: 24, width: 32 },
  stepText: { flex: 1 },
  stepTitle: { color: Signal.ink, fontFamily: SignalFonts.sans, fontSize: 17, fontWeight: '700', marginBottom: 4 },
  stepCopy: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, ...SignalType.small },
  footer: { color: Signal.ink, fontFamily: SignalFonts.display, fontStyle: 'italic', textAlign: 'center', fontSize: 17, marginTop: 40 },
});
