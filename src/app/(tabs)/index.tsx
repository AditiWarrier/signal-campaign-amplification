import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useWebScrollDiagnostics } from '@/hooks/use-web-scroll-diagnostics';

const C = {
  paper: '#EEE8DF', white: '#FFFEFA', ink: '#302A25', muted: '#776E65',
  line: '#E8E1D7', brown: '#74563F', brownLight: '#EDE5DA', green: '#536D58',
};
const DEMO_REACH_PER_DOLLAR = 12; // Configurable illustrative assumption only.

type Campaign = {
  category: string; title: string; creator: string; summary: string;
  raised: number; goal: number; color: string; reach: number;
};

const campaigns: Campaign[] = [
  { category: 'Community · Mutual aid', title: 'A warmer winter for every neighbor', creator: 'Eastside Community Pantry · Nonprofit', summary: 'Help local volunteers share winter pantry hours and get essentials to families who need them.', raised: 1840, goal: 4000, color: '#D9C8AE', reach: 48000 },
  { category: 'Climate · Local action', title: 'Bring the creek back to life', creator: 'Maya Chen · Community organizer', summary: 'A neighborhood restoration day, with practical ways for nearby residents to take part.', raised: 2675, goal: 5000, color: '#C5D0B9', reach: 60000 },
  { category: 'Arts · Independent media', title: 'Stories from the last corner shop', creator: 'Open Frame Studio · Artist collective', summary: 'An independent short film celebrating the people and places that make a block feel like home.', raised: 920, goal: 3000, color: '#D8C4BC', reach: 36000 },
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
  { name: 'Amara Lewis', cause: 'Neighborhood food access', description: 'Bringing more neighbors together to make fresh food easier to find and share.', portrait: '#A96F52', backdrop: '#E5D5C1', clothing: '#64745F' },
  { name: 'Leo Nakamura', cause: 'Urban creek restoration', description: 'Helping local volunteers restore a healthier home for wildlife along the creek.', portrait: '#D19B72', backdrop: '#D9E0D2', clothing: '#687D89' },
  { name: 'Sofia Reyes', cause: 'Independent local stories', description: 'Making a short film that celebrates the people who give a neighborhood its character.', portrait: '#C58365', backdrop: '#E8D8D0', clothing: '#826A78' },
];

function SectionTitle({ title, action }: { title: string; action?: () => void }) {
  return <View style={s.sectionHead}><Text style={s.sectionTitle}>{title}</Text>{action && <Pressable accessibilityRole="button" onPress={action}><Text style={s.textLink}>See all →</Text></Pressable>}</View>;
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const [saved, setSaved] = useState(false);
  const progress = Math.min(campaign.raised / campaign.goal, 1);
  return <View style={s.card}>
    <View style={[s.cover, { backgroundColor: campaign.color }]}><View style={s.coverMark}><Text style={s.coverMarkText}>S</Text></View><Text style={s.coverCaption}>CAMPAIGN IMAGE</Text></View>
    <View style={s.cardBody}>
      <Text style={s.category}>{campaign.category.toUpperCase()}</Text>
      <Text style={s.campaignTitle}>{campaign.title}</Text>
      <Text style={s.creator}>By {campaign.creator}</Text>
      <Text style={s.summary}>{campaign.summary}</Text>
      <View style={s.moneyRow}><Text style={s.money}>${campaign.raised.toLocaleString()} <Text style={s.mutedInline}>raised</Text></Text><Text style={s.goal}>of ${campaign.goal.toLocaleString()}</Text></View>
      <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} style={s.progressTrack}><View style={[s.progressFill, { width: `${progress * 100}%` }]} /></View>
      <Text style={s.reachText}>Estimated reach at goal <Text style={s.reachNumber}>~{campaign.reach.toLocaleString()}</Text></Text>
      <Pressable accessibilityRole="button" style={({ pressed }) => [s.cardButton, pressed && s.pressed]} onPress={() => Alert.alert('Demo campaign', 'Contributions are not enabled yet. No payment has been taken.')}><Text style={s.cardButtonText}>Back this campaign</Text><Text style={s.cardButtonArrow}>→</Text></Pressable>
    </View>
  </View>;
}

function ImpactPersonCard({ person }: { person: ImpactPerson }) {
  return <View style={s.personCard}>
    <View style={[s.portrait, { backgroundColor: person.backdrop }]} accessibilityLabel={`Illustrated portrait placeholder for ${person.name}`}>
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
  useWebScrollDiagnostics(scrollRef, 'home');

  return <SafeAreaView style={s.safe} edges={['top']}><ScrollView
    ref={scrollRef}
    style={s.scroll}
    contentContainerStyle={s.content}
    showsVerticalScrollIndicator
    >
    <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Open profile" style={s.avatar} onPress={() => router.push('/profile' as never)}><Text style={s.avatarText}>S</Text></Pressable></View>
    <View style={s.hero}><Text style={s.wordmark}>SIGNAL</Text><Text style={s.heroTitle}>The world can't hear what it never sees.</Text><Text style={s.heroCopy}>Discover campaigns that matter. Contribute to helping their messages reach people who haven't heard them yet.</Text>
      <View style={s.actionRow}>
        <Pressable accessibilityRole="button" style={({ pressed }) => [s.primaryButton, pressed && s.pressed]} onPress={() => router.push('/explore')}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={s.primaryText}>Explore Campaigns</Text><Text style={s.primaryArrow}>↗</Text></Pressable>
        <Pressable accessibilityRole="button" style={({ pressed }) => [s.secondaryButton, pressed && s.pressed]} onPress={() => router.push('/create' as never)}><Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.82} style={s.secondaryText}>Start a Campaign</Text></Pressable>
      </View>
    </View>
    <View style={s.reachBox}><View style={s.reachIcon}><Text style={s.reachIconText}>↗</Text></View><View style={s.reachCopy}><Text style={s.reachHeading}>A little support can travel far.</Text><Text style={s.reachDescription}>Community funding can help a message reach beyond its existing circle. At goal, we illustrate about {DEMO_REACH_PER_DOLLAR} potential views per dollar.</Text><Text style={s.disclaimer}>Demo estimate only. Not a guarantee or a live advertising integration.</Text></View></View>
    <View style={s.feed}><SectionTitle title="Campaigns Around the World" action={() => router.push('/explore')} />{campaigns.map((campaign) => <CampaignCard key={campaign.title} campaign={campaign} />)}</View>
    <View style={s.peopleSection}>
      <SectionTitle title="People Making an Impact" />
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
  safe: { flex: 1, minHeight: 0, backgroundColor: C.paper }, scroll: { flex: 1, minHeight: 0 }, content: { paddingHorizontal: 22, paddingBottom: 120, maxWidth: 680, width: '100%', alignSelf: 'center' },
  header: { height: 54, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' }, wordmark: { color: C.ink, letterSpacing: 2.4, fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: 32 }, avatar: { width: 38, height: 38, borderRadius: 20, backgroundColor: C.brownLight, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: C.brown, fontWeight: '700', fontSize: 15 },
  hero: { paddingTop: 15, paddingBottom: 30 }, heroTitle: { color: C.ink, fontSize: 36, lineHeight: 42, fontWeight: '500', maxWidth: 560, width: '100%', alignSelf: 'center', textAlign: 'center' }, heroCopy: { color: C.muted, fontSize: 16, lineHeight: 25, marginTop: 15, marginBottom: 23, maxWidth: 480, alignSelf: 'center', textAlign: 'center' }, actionRow: { flexDirection: 'row', gap: 10 }, primaryButton: { flex: 1, minWidth: 0, minHeight: 50, paddingHorizontal: 6, borderRadius: 7, backgroundColor: C.brown, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 }, primaryText: { color: C.white, fontSize: 13, fontWeight: '700', flexShrink: 1 }, primaryArrow: { color: C.white, fontSize: 15 }, secondaryButton: { flex: 1, minWidth: 0, minHeight: 50, paddingHorizontal: 6, borderWidth: 1, borderColor: C.brown, borderRadius: 7, alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: C.brown, fontSize: 13, fontWeight: '700', flexShrink: 1 }, pressed: { opacity: 0.72 },
  reachBox: { flexDirection: 'row', gap: 13, padding: 17, backgroundColor: '#EFEAE1', borderRadius: 9, marginBottom: 40 }, reachIcon: { height: 30, width: 30, borderRadius: 15, backgroundColor: C.white, alignItems: 'center', justifyContent: 'center' }, reachIconText: { color: C.green, fontSize: 17, fontWeight: '700' }, reachCopy: { flex: 1 }, reachHeading: { color: C.ink, fontSize: 14, fontWeight: '700', marginBottom: 5 }, reachDescription: { color: C.muted, fontSize: 12, lineHeight: 18 }, disclaimer: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 7 },
  feed: { gap: 16 }, sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 3, gap: 10 }, sectionTitle: { color: C.ink, fontSize: 25, fontWeight: '600', letterSpacing: -0.5, flexShrink: 1 }, textLink: { color: C.brown, fontSize: 12, fontWeight: '700', paddingBottom: 4 },
  peopleSection: { paddingTop: 40 }, peopleNote: { color: C.muted, fontSize: 11, marginTop: 6, marginBottom: 14 }, peopleRow: { gap: 12, paddingRight: 22 }, personCard: { width: 220, borderWidth: 1, borderColor: C.line, borderRadius: 9, overflow: 'hidden', backgroundColor: C.white }, portrait: { height: 126, alignItems: 'center', justifyContent: 'flex-end', overflow: 'hidden', position: 'relative' }, portraitHair: { position: 'absolute', width: 48, height: 50, borderRadius: 24, top: 21 }, portraitFace: { position: 'absolute', width: 36, height: 42, borderRadius: 19, top: 28 }, portraitBody: { position: 'absolute', width: 104, height: 64, borderTopLeftRadius: 52, borderTopRightRadius: 52, bottom: -19 }, personCardBody: { padding: 14 }, personName: { color: C.ink, fontSize: 15, fontWeight: '700' }, personCause: { color: C.brown, fontSize: 11, fontWeight: '700', marginTop: 5 }, personDescription: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 7 },
  card: { borderWidth: 1, borderColor: C.line, borderRadius: 9, overflow: 'hidden', backgroundColor: C.white }, cover: { height: 142, justifyContent: 'center', alignItems: 'center' }, coverMark: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,254,250,0.55)', justifyContent: 'center', alignItems: 'center' }, coverMarkText: { color: C.brown, fontSize: 23, fontWeight: '600' }, coverCaption: { position: 'absolute', bottom: 12, right: 13, color: 'rgba(48,42,37,0.52)', fontSize: 8, letterSpacing: 1.2, fontWeight: '700' }, cardBody: { padding: 16 }, category: { color: C.green, fontSize: 9, fontWeight: '700', letterSpacing: 1.1, marginBottom: 7 }, campaignTitle: { color: C.ink, fontSize: 20, lineHeight: 25, fontWeight: '600' }, creator: { color: C.muted, fontSize: 11, marginTop: 5 }, summary: { color: C.muted, fontSize: 13, lineHeight: 20, marginTop: 11, marginBottom: 16 }, moneyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }, money: { color: C.ink, fontSize: 14, fontWeight: '700' }, mutedInline: { color: C.muted, fontSize: 11, fontWeight: '400' }, goal: { color: C.muted, fontSize: 11 }, progressTrack: { height: 5, borderRadius: 3, overflow: 'hidden', backgroundColor: '#EEE9E0' }, progressFill: { height: 5, borderRadius: 3, backgroundColor: C.green }, reachText: { color: C.muted, fontSize: 10, marginTop: 9 }, reachNumber: { color: C.ink, fontWeight: '700' }, cardButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 42, borderWidth: 1, borderColor: C.line, borderRadius: 6, marginTop: 14, gap: 8 }, cardButtonText: { color: C.brown, fontSize: 12, fontWeight: '700' }, cardButtonArrow: { color: C.brown },
  how: { paddingTop: 42 }, step: { flexDirection: 'row', gap: 15, paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: C.line }, stepNumber: { color: C.brown, fontSize: 11, fontWeight: '700', paddingTop: 2, width: 24 }, stepText: { flex: 1 }, stepTitle: { color: C.ink, fontSize: 16, fontWeight: '700', marginBottom: 4 }, stepCopy: { color: C.muted, fontSize: 12, lineHeight: 19 }, footer: { color: C.brown, textAlign: 'center', fontSize: 12, letterSpacing: 0.7, marginTop: 29 },
});
