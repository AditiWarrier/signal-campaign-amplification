import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { ClipPath, Defs, Image as SvgImage, Path, Text as SvgText, TextPath } from 'react-native-svg';
import { useFocusEffect } from 'expo-router';

import { Fonts } from '@/constants/theme';
import { useWebScrollDiagnostics } from '@/hooks/use-web-scroll-diagnostics';
import { readCampaignDemoContributions } from '@/data/demo-contributions';
import { parseUsdMinor } from '@/data/funding';

const HOME = {
  background: '#E8D5BD',
  olive: '#626B42',
  mauve: '#B98291',
  blue: '#2589E8',
  primary: '#382D27',
  secondary: '#514239',
  surface: '#D6C0A5',
  white: '#FFFFFF',
  border: '#FFFDF8',
} as const;
const DEMO_REACH_PER_DOLLAR = 12; // Configurable illustrative assumption only.
const HOME_HEADLINE_FONT = Platform.select({ web: 'Georgia, Times New Roman, serif', default: 'serif' }) ?? 'serif';

type Campaign = {
  id: string; category: string; title: string; creator: string; summary: string;
  raised: number; goal: number; color: string; reach: number;
};

const campaigns: Campaign[] = [
  { id: 'neighbors-share-fresh-food', category: 'Community · Mutual aid', title: 'Neighbors share fresh food', creator: 'Eastside Pantry Project (fictional)', summary: 'A sample community pantry is raising awareness of its weekly produce exchange and volunteer sign-up days.', raised: 1840, goal: 4000, color: HOME.surface, reach: 48000 },
  { id: 'creekside-native-plants', category: 'Climate · Local action', title: 'Bring Creekside back to life', creator: 'Creekside Neighbors (fictional group)', summary: 'A volunteer group is organizing a native planting day and sharing simple ways nearby residents can care for the creek.', raised: 2675, goal: 5000, color: HOME.surface, reach: 60000 },
  { id: 'stories-from-main-street', category: 'Arts · Independent media', title: 'Stories from Main Street', creator: 'Open Frame Studio (fictional collective)', summary: 'An independent fictional arts collective is preparing a short film about the people who make a neighborhood feel like home.', raised: 920, goal: 3000, color: HOME.surface, reach: 36000 },
];

type ImpactPerson = {
  name: string;
  cause: string;
  description: string;
  portrait: string;
  backdrop: string;
  clothing: string;
};

const impactPeople: ImpactPerson[] = [
  { name: 'Amara Lewis', cause: 'Neighborhood food access', description: 'Bringing more neighbors together to make fresh food easier to find and share.', portrait: HOME.mauve, backdrop: HOME.surface, clothing: HOME.olive },
  { name: 'Leo Nakamura', cause: 'Urban creek restoration', description: 'Helping local volunteers restore a healthier home for wildlife along the creek.', portrait: HOME.mauve, backdrop: HOME.surface, clothing: HOME.olive },
  { name: 'Sofia Reyes', cause: 'Independent local stories', description: 'Making a short film that celebrates the people who give a neighborhood its character.', portrait: HOME.mauve, backdrop: HOME.surface, clothing: HOME.olive },
];

function SectionTitle({ title, action }: { title: string; action?: () => void }) {
  return <View style={s.sectionHead}><Text style={s.sectionTitle}>{title}</Text>{action && <Pressable accessibilityRole="button" onPress={action}><Text style={s.textLink}>See all →</Text></Pressable>}</View>;
}

function CampaignCard({ campaign, demoRaisedMinor, demoContributionCount }: { campaign: Campaign; demoRaisedMinor: number; demoContributionCount: number }) {
  const [saved, setSaved] = useState(false);
  const raisedMinor = Math.min(Number.MAX_SAFE_INTEGER, parseUsdMinor(campaign.raised) + demoRaisedMinor);
  const goalMinor = parseUsdMinor(campaign.goal);
  const raised = raisedMinor / 100;
  const progress = goalMinor > 0 ? Math.min(raisedMinor / goalMinor, 1) : 0;
  return <View style={s.card}>
    <View style={[s.cover, { backgroundColor: campaign.color }]}><View style={s.coverMark}><Text style={s.coverMarkText}>S</Text></View><Text style={s.coverCaption}>CAMPAIGN IMAGE</Text></View>
    <View style={s.cardBody}>
      <Text style={s.category}>{campaign.category.toUpperCase()}</Text>
      <Text style={s.campaignTitle}>{campaign.title}</Text>
      <Text style={s.creator}>By {campaign.creator}</Text>
      <Text style={s.summary}>{campaign.summary}</Text>
      <View style={s.moneyRow}><Text style={s.money}>${raised.toLocaleString('en-US', { maximumFractionDigits: 2 })} <Text style={s.mutedInline}>demo total</Text></Text><Text style={s.goal}>of ${campaign.goal.toLocaleString()}</Text></View>
      <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} style={s.progressTrack}><View style={[s.progressFill, { width: `${progress * 100}%` }]} /></View>
      <Text style={s.reachText}>{demoContributionCount} simulated demo {demoContributionCount === 1 ? 'contribution' : 'contributions'} · no payments</Text>
      <Text style={s.reachText}>Estimated reach at goal <Text style={s.reachNumber}>~{campaign.reach.toLocaleString()}</Text></Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Back this Campaign: ${campaign.title}. Demo contribution only.`} style={({ pressed }) => [s.cardButton, pressed && s.pressed]} onPress={() => router.push({ pathname: '/campaign/[id]', params: { id: campaign.id } } as never)}><Text style={s.cardButtonText}>Back this Campaign</Text><Text style={s.cardButtonArrow}>→</Text></Pressable>
    </View>
  </View>;
}

function ImpactPersonCard({ person }: { person: ImpactPerson }) {
  return <View style={s.personCard}>
    <View style={[s.portrait, { backgroundColor: person.backdrop }]} accessibilityLabel={`Illustrated portrait for fictional demo profile ${person.name}`}>
      <View style={[s.portraitHair, { backgroundColor: person.clothing }]} />
      <View style={[s.portraitFace, { backgroundColor: person.portrait }]} />
      <View style={[s.portraitBody, { backgroundColor: person.clothing }]} />
    </View>
    <View style={s.personCardBody}>
      <Text style={s.personName}>{person.name}</Text>
      <Text style={s.personCause}>{person.cause}</Text>
      <Text style={s.personDescription}>{person.description}</Text>
    </View>
  </View>;
}

export default function HomeScreen() {
  const scrollRef = useRef<ScrollView>(null);
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
  const photoWidth = Math.min(windowWidth, 680);
  const photoHeight = photoWidth * 0.53;
  const headlineFontSize = Math.min(48, Math.max(34, photoWidth * 0.069));
  const archEdgeY = photoHeight * 0.37;
  const archControlY = photoHeight * 0.04;
  const curveOffset = headlineFontSize * 0.2;
  const imageAspect = 4179 / 3448;
  const imageCropLeft = 0.12;
  const imageCropWidth = 0.87;
  const imageWidth = photoWidth / imageCropWidth;
  const imageHeight = imageWidth / imageAspect;
  const imageX = -imageWidth * imageCropLeft;
  const imageY = -imageHeight * 0.28;
  const photoArch = `M0 ${archEdgeY} Q${photoWidth / 2} ${archControlY} ${photoWidth} ${archEdgeY} L${photoWidth} ${photoHeight} L0 ${photoHeight} Z`;
  const headlineCurve = `M0 ${archEdgeY + curveOffset} Q${photoWidth / 2} ${archControlY + curveOffset} ${photoWidth} ${archEdgeY + curveOffset}`;
  const photoGroupOffset = -photoHeight * 0.205 + headlineFontSize * 0.78;

  return <SafeAreaView style={s.safe} edges={['top']}><ScrollView
    ref={scrollRef}
    style={s.scroll}
    contentContainerStyle={s.content}
    showsVerticalScrollIndicator
    >
    <View style={s.hero}>
      <View style={s.header}><Text style={s.wordmark}>SIGNAL</Text><Pressable accessibilityRole="button" accessibilityLabel="Open profile" style={s.avatar} onPress={() => router.push('/profile' as never)}><Text style={s.avatarText}>S</Text></Pressable></View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={[s.heroTitle, { fontFamily: HOME_HEADLINE_FONT, fontSize: headlineFontSize, lineHeight: headlineFontSize * 1.12 }]}>The World Can't Hear</Text>
      <View style={[s.photoGroup, { marginTop: photoGroupOffset }]}>
        <Svg width={photoWidth} height={photoHeight} viewBox={`0 0 ${photoWidth} ${photoHeight}`} accessibilityRole="image" accessibilityLabel="The World Can't Hear What It Can't See. Campaign community group photograph.">
          <Defs>
            <ClipPath id="home-photo-arch"><Path d={photoArch} /></ClipPath>
            <Path id="home-headline-curve" d={headlineCurve} />
          </Defs>
          <SvgImage href={require('../../../assets/images/community-people.jpg')} x={imageX} y={imageY} width={imageWidth} height={imageHeight} preserveAspectRatio="none" clipPath="url(#home-photo-arch)" />
          <SvgText fill={HOME.primary} fontFamily={HOME_HEADLINE_FONT} fontSize={headlineFontSize} fontWeight="600" textAnchor="middle">
            <TextPath href="#home-headline-curve" startOffset="50%">What It Can't See.</TextPath>
          </SvgText>
        </Svg>
      </View>
      <Text style={s.heroCopy}>Important messages deserve to reach beyond their immediate circles. Together, we fund their amplification across relevant platforms like Instagram and Facebook, helping more people discover the causes that matter and giving those messages a greater chance to inspire action.</Text>
      <View style={s.actionRow}>
        <Pressable accessibilityRole="button" style={({ pressed }) => [s.primaryButton, pressed && s.pressed]} onPress={() => router.push('/explore')}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={s.primaryText}>Explore Campaigns</Text></Pressable>
        <Pressable accessibilityRole="button" style={({ pressed }) => [s.primaryButton, pressed && s.pressed]} onPress={() => router.push('/create' as never)}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={s.primaryText}>Start a Campaign</Text></Pressable>
      </View>
      <View style={s.reachBox}><Text style={s.reachHeading}>Illustrative estimated reach per dollar</Text><Text style={s.reachDescription}>About <Text style={s.reachEstimateFigure}>{DEMO_REACH_PER_DOLLAR}</Text> potential views per dollar, based on a configurable demo assumption.</Text><Text style={s.disclaimer}>Actual reach may vary and is not guaranteed.</Text></View>
    </View>
    <View style={s.feed}><SectionTitle title="Campaigns Around the World" action={() => router.push('/explore')} />{campaigns.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} demoRaisedMinor={demoTotals[campaign.id]?.amountMinor ?? 0} demoContributionCount={demoTotals[campaign.id]?.count ?? 0} />)}</View>
    <View style={s.peopleSection}>
      <SectionTitle title="People Who Actually Make an Impact" />
      <Text style={s.peopleNote}>Fictional demo profiles</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={s.peopleRow}>
        {impactPeople.map((person) => <ImpactPersonCard key={person.name} person={person} />)}
      </ScrollView>
    </View>
    <View style={s.how}><SectionTitle title="How It Works" />{[
      ['01', 'Create', 'Tell the story, set a goal, and show what wider reach could mean.'],
      ['02', 'Review', 'We review every campaign for clarity, safety, and community fit.'],
      ['03', 'Amplify', 'When a campaign is ready, supporters help its message travel further.'],
    ].map(([number, title, detail]) => <View key={number} style={s.step}><Text style={s.stepNumber}>{number}</Text><View style={s.stepText}><Text style={s.stepTitle}>{title}</Text><Text style={s.stepCopy}>{detail}</Text></View></View>)}</View>
    <Text style={s.footer}>Small signals. Wider circles.</Text>
  </ScrollView></SafeAreaView>;
}

const s = StyleSheet.create({
  safe: { flex: 1, minHeight: 0, backgroundColor: HOME.background }, scroll: { flex: 1, minHeight: 0, backgroundColor: HOME.background }, content: { paddingHorizontal: 22, paddingBottom: 120, maxWidth: 680, width: '100%', alignSelf: 'center', backgroundColor: HOME.background },
  header: { height: 52, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }, wordmark: { color: HOME.primary, letterSpacing: 2.4, fontSize: 12, fontWeight: '700' }, avatar: { width: 38, height: 38, borderRadius: 20, backgroundColor: HOME.surface, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: HOME.primary, fontWeight: '700', fontSize: 15 },
  hero: { marginHorizontal: -22, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 34, backgroundColor: HOME.background }, heroTitle: { color: HOME.primary, fontSize: 36, lineHeight: 42, fontWeight: '600', maxWidth: 620, width: '100%', alignSelf: 'center', textAlign: 'center' }, actionRow: { flexDirection: 'row', gap: 12, marginTop: 24 }, primaryButton: { flex: 1, minWidth: 0, minHeight: 50, paddingHorizontal: 12, borderRadius: 25, backgroundColor: HOME.olive, alignItems: 'center', justifyContent: 'center' }, primaryText: { color: HOME.white, fontSize: 13, fontWeight: '700', flexShrink: 1 }, pressed: { opacity: 0.72 }, photoGroup: { marginHorizontal: -22, marginTop: 28, alignItems: 'center' }, heroCopy: { color: HOME.secondary, fontFamily: Fonts.sans, fontSize: 16, lineHeight: 25, textAlign: 'left', marginHorizontal: 0, marginTop: 20, maxWidth: 620, width: '100%', alignSelf: 'center' },
  reachBox: { padding: 16, backgroundColor: HOME.background, borderColor: HOME.border, borderWidth: 1, marginTop: 16, marginHorizontal: -6 }, reachHeading: { color: HOME.primary, fontFamily: Fonts.sans, fontSize: 16, lineHeight: 22, fontWeight: '700', marginBottom: 6 }, reachDescription: { color: HOME.secondary, fontFamily: Fonts.sans, fontSize: 15, lineHeight: 22 }, reachEstimateFigure: { color: HOME.blue, fontWeight: '700' }, disclaimer: { color: HOME.secondary, fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19, marginTop: 7 },
  feed: { gap: 16 }, sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 3, gap: 10 }, sectionTitle: { color: HOME.primary, fontSize: 25, fontWeight: '600', letterSpacing: -0.5, flexShrink: 1 }, textLink: { color: HOME.blue, fontSize: 12, fontWeight: '700', paddingBottom: 4 },
  peopleSection: { paddingTop: 40 }, peopleNote: { color: HOME.secondary, fontSize: 11, marginTop: 6, marginBottom: 14 }, peopleRow: { gap: 20, paddingRight: 22, paddingVertical: 4 }, personCard: { width: 150, alignItems: 'center' }, portrait: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden', position: 'relative' }, portraitHair: { position: 'absolute', width: 60, height: 58, borderRadius: 30, top: 12 }, portraitFace: { position: 'absolute', width: 44, height: 50, borderRadius: 24, top: 21 }, portraitBody: { position: 'absolute', width: 98, height: 54, borderTopLeftRadius: 49, borderTopRightRadius: 49, bottom: -18 }, personCardBody: { alignItems: 'center', paddingTop: 11 }, personName: { color: HOME.primary, fontSize: 14, fontWeight: '700', textAlign: 'center' }, personCause: { color: HOME.mauve, fontSize: 11, fontWeight: '700', marginTop: 4, textAlign: 'center' }, personDescription: { color: HOME.secondary, fontSize: 10, lineHeight: 15, marginTop: 5, textAlign: 'center' },
  card: { borderWidth: 1, borderColor: HOME.border, borderRadius: 9, overflow: 'hidden', backgroundColor: HOME.surface }, cover: { height: 142, justifyContent: 'center', alignItems: 'center' }, coverMark: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,253,248,0.55)', justifyContent: 'center', alignItems: 'center' }, coverMarkText: { color: HOME.primary, fontSize: 23, fontWeight: '600' }, coverCaption: { position: 'absolute', bottom: 12, right: 13, color: HOME.primary, fontSize: 8, letterSpacing: 1.2, fontWeight: '700' }, cardBody: { padding: 16 }, category: { color: HOME.mauve, fontSize: 9, fontWeight: '700', letterSpacing: 1.1, marginBottom: 7 }, campaignTitle: { color: HOME.primary, fontSize: 20, lineHeight: 25, fontWeight: '600' }, creator: { color: HOME.secondary, fontSize: 11, marginTop: 5 }, summary: { color: HOME.secondary, fontSize: 13, lineHeight: 20, marginTop: 11, marginBottom: 16 }, moneyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }, money: { color: HOME.primary, fontSize: 14, fontWeight: '700' }, mutedInline: { color: HOME.secondary, fontSize: 11, fontWeight: '400' }, goal: { color: HOME.secondary, fontSize: 11 }, progressTrack: { height: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: HOME.surface }, progressFill: { height: 5, borderRadius: 3, backgroundColor: HOME.olive }, reachText: { color: HOME.secondary, fontSize: 10, marginTop: 9 }, reachNumber: { color: HOME.primary, fontWeight: '700' }, cardButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 42, borderWidth: 1, borderColor: HOME.border, borderRadius: 22, marginTop: 14, gap: 8 }, cardButtonText: { color: HOME.blue, fontSize: 12, fontWeight: '700' }, cardButtonArrow: { color: HOME.blue },
  how: { paddingTop: 42 }, step: { flexDirection: 'row', gap: 15, paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: HOME.border }, stepNumber: { color: HOME.olive, fontSize: 11, fontWeight: '700', paddingTop: 2, width: 24 }, stepText: { flex: 1 }, stepTitle: { color: HOME.primary, fontSize: 16, fontWeight: '700', marginBottom: 4 }, stepCopy: { color: HOME.secondary, fontSize: 12, lineHeight: 19 }, footer: { color: HOME.primary, textAlign: 'center', fontSize: 12, letterSpacing: 0.7, marginTop: 29 },
});
