import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { discoveryCategories } from '@/data/campaigns';
import { Signal, SignalFonts } from '@/constants/theme';

const sections = [
  { id: 'three-pillars', title: 'Three Pillars' },
  { id: 'review-process', title: 'Review Process' },
  { id: 'score-tiers', title: 'Score Tiers' },
  { id: 'transparency', title: 'Transparency' },
  { id: 'categories', title: 'Categories' },
  { id: 'fairness-wheel', title: 'Fairness Wheel' },
  { id: 'evaluation', title: 'Evaluation' },
  { id: 'faq', title: 'FAQ' },
] as const;

type SectionId = (typeof sections)[number]['id'];

export default function HowItWorksScreen() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Partial<Record<SectionId, number>>>({});
  const requestedSection = sections.find((item) => item.id === section)?.id ?? sections[0].id;
  const goToSection = (id: SectionId) => {
    const offset = sectionOffsets.current[id];
    if (offset !== undefined) scrollRef.current?.scrollTo({ y: offset, animated: true });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator>
        <View style={styles.pageColumn}>
          <Pressable accessibilityRole="button" onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/' as never); }} style={styles.backButton}>
            <Text style={styles.backText}>‹  Back</Text>
          </Pressable>
        </View>

        <View style={styles.heroOuter}>
          <View style={styles.heroPanels}>
            <View style={styles.heroLight}>
              <Text style={styles.heroEyebrow}>HOW IT WORKS</Text>
              <Text accessibilityRole="header" style={styles.heroTitle}>Some voices{ '\n' }never travel{ '\n' }far.</Text>
              <Text style={styles.heroLightCopy}>Important concerns can stay within small circles, unseen by the people who could respond.</Text>
            </View>
            <View style={styles.heroGreen}>
              <Text style={styles.heroEyebrowLight}>OUR AIM</Text>
              <Text style={styles.heroTitleLight}>Every voice{ '\n' }has a way{ '\n' }forward.</Text>
              <Text style={styles.heroGreenCopy}>Campaign amplification can help important messages travel beyond the networks they already reach.</Text>
              <Text accessibilityElementsHidden style={styles.heroArrow}>↗</Text>
            </View>
          </View>
        </View>

        <View style={styles.purposeOuter}>
          <Text accessibilityRole="header" style={styles.purposeTitle}>We exist to help{ '\n' }close the gap.</Text>
          <Text style={styles.purposeCopy}>Between a person with a concern and the people who may be able to respond. SIGNAL brings campaign stories and shared support together to help messages reach wider audiences.</Text>
          <Pressable accessibilityRole="link" onPress={() => goToSection('three-pillars')} style={styles.purposeLink}>
            <Text style={styles.purposeLinkText}>OUR PURPOSE  ↘</Text>
          </Pressable>
        </View>

        {sections.map((item, index) => (
            <View
              key={item.id}
              nativeID={item.id}
              onLayout={(event) => {
                const offset = event.nativeEvent.layout.y;
                sectionOffsets.current[item.id] = offset;
                if (section && item.id === requestedSection) scrollRef.current?.scrollTo({ y: offset, animated: false });
              }}
              style={styles.section}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <View style={styles.sectionBody}>
                <Text accessibilityRole="header" style={styles.sectionTitle}>{item.title}</Text>
                {item.id === 'three-pillars' ? <ThreePillars /> : null}
                {item.id === 'review-process' ? <ReviewProcess /> : null}
                {item.id === 'score-tiers' ? <ScoreTiers /> : null}
                {item.id === 'transparency' ? <Transparency /> : null}
                {item.id === 'categories' ? <Categories /> : null}
                {item.id === 'fairness-wheel' ? <FairnessWheel /> : null}
                {item.id === 'evaluation' ? <Evaluation /> : null}
                {item.id === 'faq' ? <Faq /> : null}
              </View>
            </View>
          ))}

        <View style={styles.taglineWrap}>
          <Text style={styles.tagline}>Small signals. Wider circles.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ThreePillars() {
  const items = [
    { number: '01', title: 'Campaign stories', copy: 'Campaigners can explain what matters to them and outline the audience and channels they hope to reach.' },
    { number: '02', title: 'Shared backing', copy: 'People can contribute toward message amplification. The current contribution flow is simulated and is not a direct donation to a cause.' },
    { number: '03', title: 'Clear expectations', copy: 'Funding progress and reach estimates are illustrative. The app does not currently confirm ad delivery or measured campaign results.' },
  ];
  return <View>
    <Text style={styles.sectionCopy}>A practical view of the current app: campaign stories, shared support for amplification, and clear expectations about what is—and is not—measured.</Text>
    {items.map((item) => <View key={item.number} style={styles.pillarRow}>
      <Text style={styles.rowNumber}>{item.number}</Text>
      <View style={styles.rowText}><Text style={styles.rowTitle}>{item.title}</Text><Text style={styles.sectionCopy}>{item.copy}</Text></View>
    </View>)}
    <Text style={styles.note}>These points describe the current product experience; they are not a scoring or certification framework.</Text>
  </View>;
}

function ReviewProcess() {
  return <View style={styles.copyStack}>
    <Text style={styles.sectionCopy}>Campaigners can create a campaign, save a device draft, or submit it for review. When the SIGNAL API is configured, a submission can also be sent to it.</Text>
    <Text style={styles.sectionCopy}>A local saved or submitted status is not proof that a reviewer received or approved a campaign. Check the status shown in the app; only an API-confirmed status reflects a response from that service.</Text>
    <Text style={styles.note}>Review criteria and review-time estimates are not currently published in the app.</Text>
  </View>;
}

function ScoreTiers() {
  return <View style={styles.scoreCard}>
    <Text style={styles.sectionCopy}>An illustrative tier guide could describe how clearly a campaign is framed. These examples are for explanation only; SIGNAL does not currently define or apply score tiers, thresholds, or a scoring rubric.</Text>
    <View style={styles.tierList}>
      <View style={styles.tierRow}>
        <Text style={styles.tierLabel}>Starting point</Text>
        <Text style={styles.tierCopy}>The campaign introduces its concern and the people it hopes to reach.</Text>
      </View>
      <View style={styles.tierRow}>
        <Text style={styles.tierLabel}>Taking shape</Text>
        <Text style={styles.tierCopy}>The story adds context and describes a possible amplification approach.</Text>
      </View>
      <View style={[styles.tierRow, styles.tierRowLast]}>
        <Text style={styles.tierLabel}>Clearly framed</Text>
        <Text style={styles.tierCopy}>The purpose, intended audience, and use of campaign funding are explained.</Text>
      </View>
    </View>
    <Text style={styles.note}>These are illustrative descriptions, not campaign ratings or SIGNAL evaluation results.</Text>
  </View>;
}

function Transparency() {
  return <View style={styles.copyStack}>
    <Text style={styles.sectionCopy}>Funding progress can include bundled catalogue values or simulated contribution records. It does not show money transferred to an advertising account.</Text>
    <Text style={styles.sectionCopy}>Potential reach and other performance estimates are illustrative, not measured results or promises. The app does not currently confirm ad delivery, impressions, or clicks.</Text>
  </View>;
}

function Categories() {
  return <View>
    <Text style={styles.sectionCopy}>These are the categories currently available in Explore Campaigns.</Text>
    <View style={styles.categoryList}>{discoveryCategories.filter((category) => category !== 'All').map((category) => <View key={category} style={styles.categoryChip}><Text style={styles.categoryText}>{category}</Text></View>)}</View>
    <Pressable accessibilityRole="link" onPress={() => router.push('/explore')} style={styles.actionLink}><Text style={styles.actionLinkText}>Explore campaigns  →</Text></Pressable>
  </View>;
}

function FairnessWheel() {
  const principles = [
    { title: 'Voice', copy: 'Make room for people closest to an issue to explain it in their own words.' },
    { title: 'Access', copy: 'Consider whether reach depends only on existing networks or resources.' },
    { title: 'Context', copy: 'Keep a campaign’s circumstances and intended audience in view.' },
    { title: 'Clarity', copy: 'Explain purpose, funding use, and what progress can and cannot show.' },
  ];
  return <View style={styles.redCard}>
    <Text style={styles.redCardCopy}>These illustrative principles can help frame fairer campaign amplification. They are discussion prompts, not checks SIGNAL currently performs or verifies.</Text>
    <View style={styles.fairnessGrid}>
      {principles.map((item) => <View key={item.title} style={styles.fairnessItem}>
        <Text style={styles.fairnessTitle}>{item.title}</Text>
        <Text style={styles.fairnessCopy}>{item.copy}</Text>
      </View>)}
    </View>
  </View>;
}

function Evaluation() {
  return <View style={styles.copyStack}>
    <Text style={styles.sectionCopy}>The app can show catalogue status, a device-local draft or submission status, and API status when a backend response is available.</Text>
    <Text style={styles.sectionCopy}>A detailed evaluation rubric, campaign score, reviewer identity, or review timeline is not currently shown. A local status should not be read as an evaluation decision.</Text>
  </View>;
}

function Faq() {
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const questions = [
    { question: 'Is a contribution a donation to the cause?', answer: 'No. Contributions are intended to support campaign amplification; they are not direct charitable donations to the named cause.' },
    { question: 'Does the current flow charge money?', answer: 'No. The contribution flow is simulated and does not contact a payment provider or collect real money.' },
    { question: 'Are reach figures guaranteed?', answer: 'No. Reach figures are illustrative estimates, not promised or measured outcomes.' },
    { question: 'Does a local submission mean a campaign is approved?', answer: 'No. A local status does not confirm that a reviewer received or approved the campaign.' },
    { question: 'Where can I see the campaign categories?', answer: 'The current categories are listed in Explore Campaigns.' },
  ];
  return <View>{questions.map((item) => {
    const expanded = expandedQuestion === item.question;
    return <View key={item.question} style={styles.faqRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${expanded ? 'Hide' : 'Show'} answer: ${item.question}`}
        onPress={() => setExpandedQuestion(expanded ? null : item.question)}
        style={styles.faqToggle}>
        <Text style={styles.faqQuestion}>{item.question}</Text>
        <Text accessibilityElementsHidden style={styles.faqIndicator}>{expanded ? '−' : '+'}</Text>
      </Pressable>
      {expanded ? <Text style={styles.faqAnswer}>{item.answer}</Text> : null}
    </View>;
  })}</View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Signal.paper },
  content: { width: '100%', paddingBottom: 44 },
  pageColumn: { width: '100%', maxWidth: 1040, paddingHorizontal: 22, alignSelf: 'center' },
  backButton: { alignSelf: 'flex-start', minHeight: 42, justifyContent: 'center', paddingRight: 14 },
  backText: { color: Signal.forest, fontFamily: SignalFonts.sans, fontSize: 13, fontWeight: '700' },
  heroOuter: { width: '100%', maxWidth: 1040, alignSelf: 'center', paddingHorizontal: 22 },
  heroPanels: { flexDirection: 'row', width: '100%', borderRadius: 10, overflow: 'hidden', minHeight: 325 },
  heroLight: { flex: 1, minWidth: 0, justifyContent: 'center', backgroundColor: Signal.paperDeep, paddingHorizontal: 18, paddingVertical: 24 },
  heroGreen: { flex: 1, minWidth: 0, justifyContent: 'center', backgroundColor: Signal.forest, paddingHorizontal: 18, paddingVertical: 24 },
  heroEyebrow: { color: Signal.maroon, fontFamily: SignalFonts.sans, fontSize: 10, lineHeight: 15, letterSpacing: 1, fontWeight: '700', marginBottom: 12 },
  heroEyebrowLight: { color: Signal.onDarkSoft, fontFamily: SignalFonts.sans, fontSize: 10, lineHeight: 15, letterSpacing: 1, fontWeight: '700', marginBottom: 12 },
  heroTitle: { color: Signal.ink, fontFamily: SignalFonts.display, fontSize: 28, lineHeight: 32, fontWeight: '700', marginBottom: 14 },
  heroTitleLight: { color: Signal.paper, fontFamily: SignalFonts.display, fontSize: 25, lineHeight: 30, fontWeight: '700', marginBottom: 14 },
  heroLightCopy: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, fontSize: 13, lineHeight: 19 },
  heroGreenCopy: { color: Signal.paper, fontFamily: SignalFonts.sans, fontSize: 13, lineHeight: 19 },
  heroArrow: { color: Signal.paper, fontSize: 22, lineHeight: 27, marginTop: 15 },
  purposeOuter: { width: '100%', maxWidth: 1040, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 26, paddingBottom: 25, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#000000' },
  purposeTitle: { color: Signal.ink, fontFamily: SignalFonts.display, fontSize: 27, lineHeight: 33, fontWeight: '700', marginBottom: 8 },
  purposeCopy: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, fontSize: 14, lineHeight: 22, maxWidth: 650 },
  purposeLink: { alignSelf: 'flex-start', paddingVertical: 12, marginTop: 4 },
  purposeLinkText: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, fontSize: 11, lineHeight: 16, letterSpacing: 0.7, fontWeight: '600' },
  section: { width: '100%' },
  sectionBody: { width: '100%', maxWidth: 900, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 27, paddingBottom: 28 },
  divider: { width: '100%', maxWidth: 856, height: StyleSheet.hairlineWidth, alignSelf: 'center', backgroundColor: '#000000' },
  sectionTitle: { color: Signal.maroon, fontFamily: SignalFonts.sans, fontSize: 15, lineHeight: 21, fontWeight: '700', letterSpacing: 1.1, marginBottom: 13 },
  sectionCopy: { color: Signal.ink, fontFamily: SignalFonts.sans, fontSize: 14, lineHeight: 22 },
  note: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, fontSize: 12, lineHeight: 18, fontStyle: 'italic', marginTop: 12 },
  pillarRow: { flexDirection: 'row', gap: 14, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Signal.hairline },
  rowNumber: { color: Signal.ink, fontFamily: SignalFonts.display, fontSize: 22, lineHeight: 28, minWidth: 36 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: Signal.ink, fontFamily: SignalFonts.sans, fontSize: 17, lineHeight: 23, fontWeight: '700', marginBottom: 5 },
  copyStack: { gap: 12 },
  scoreCard: { width: '100%', maxWidth: 864, alignSelf: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: '#000000', borderRadius: 9, padding: 18 },
  tierList: { marginTop: 15 },
  tierRow: { paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Signal.hairline },
  tierRowLast: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Signal.hairline },
  tierLabel: { color: Signal.ink, fontFamily: SignalFonts.sans, fontSize: 14, lineHeight: 20, fontWeight: '700', marginBottom: 3 },
  tierCopy: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, fontSize: 13, lineHeight: 20 },
  categoryList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 15 },
  categoryChip: { borderWidth: StyleSheet.hairlineWidth, borderColor: Signal.hairline, backgroundColor: Signal.paperDeep, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  categoryText: { color: Signal.ink, fontFamily: SignalFonts.sans, fontSize: 12, lineHeight: 17 },
  actionLink: { alignSelf: 'flex-start', paddingVertical: 12, marginTop: 5 },
  actionLinkText: { color: Signal.forest, fontFamily: SignalFonts.sans, fontSize: 14, lineHeight: 20, fontWeight: '700', textDecorationLine: 'underline' },
  redCard: { width: '100%', maxWidth: 864, alignSelf: 'center', backgroundColor: Signal.maroon, borderRadius: 10, padding: 18 },
  redCardCopy: { color: Signal.paper, fontFamily: SignalFonts.sans, fontSize: 14, lineHeight: 22 },
  fairnessGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 5 },
  fairnessItem: { width: '50%', paddingTop: 14, paddingRight: 12 },
  fairnessTitle: { color: Signal.paper, fontFamily: SignalFonts.sans, fontSize: 14, lineHeight: 20, fontWeight: '700', marginBottom: 4 },
  fairnessCopy: { color: Signal.onDarkSoft, fontFamily: SignalFonts.sans, fontSize: 12, lineHeight: 18 },
  faqRow: { paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Signal.hairline },
  faqToggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  faqQuestion: { flex: 1, color: Signal.ink, fontFamily: SignalFonts.sans, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  faqIndicator: { color: Signal.maroon, fontFamily: SignalFonts.sans, fontSize: 22, lineHeight: 26, fontWeight: '500' },
  faqAnswer: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, fontSize: 14, lineHeight: 22, marginTop: 7 },
  taglineWrap: { width: '100%', alignItems: 'center', paddingHorizontal: 22, marginTop: 25 },
  tagline: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, fontSize: 13, lineHeight: 20, letterSpacing: 0.6, textAlign: 'center' },
});
