import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Signal, SignalFonts } from '@/constants/theme';

const informationSections = [
  {
    id: 'about',
    title: 'ABOUT SIGNAL',
    paragraphs: [
      'SIGNAL helps people discover campaigns and come together to fund the distribution of campaign messages. Contributions are intended to support amplification so a message can reach a wider audience; they are not direct charitable donations to the cause named in a campaign.',
    ],
  },
  {
    id: 'terms',
    title: 'TERMS',
    paragraphs: [
      'Campaigners can prepare a campaign and submit it for review. Depending on the connection available, a draft or submission may be saved on the device, sent to the SIGNAL API, or both. A local submission notice is not proof that a reviewer received or approved the campaign.',
      'Contributions are intended to support campaign amplification and message distribution, rather than to donate directly to the underlying cause. The contribution flow currently records simulated amounts only: it does not contact a payment provider or collect real money. Funding progress can include bundled catalogue values or simulated contribution records; it does not show money transferred to an advertising account.',
      'Potential reach and other performance estimates are illustrative calculations, not promises or measured results. The app does not currently confirm ad delivery, impressions, clicks, or a completed distribution report.',
      'Before live payments or distribution are offered, the owner and legal counsel need to establish the payment provider and charges, refund and unspent-fund handling, campaign eligibility, cancellation terms, liability, and governing law. Those details are not established by the current app.',
    ],
  },
  {
    id: 'privacy',
    title: 'PRIVACY',
    paragraphs: [
      'When account services are configured, registration and sign-in handle a name (on registration), email address, and password. The app sends account credentials to the configured Supabase Auth service and stores the resulting session on the device using the platform SecureStore API.',
      'Campaign drafts may contain a campaign title, creator or organization name, story text, source links, creative copy, image references, audience and location choices, channel selections, and budget or duration settings. Drafts are saved on the device and may be sent to the SIGNAL API when that service is configured. The campaign editor stores image references; it does not upload image files.',
      'The contribution flow stores campaign and amount details, its status, and an optional first name if the contributor chooses to display one. The current checkout is simulated and does not collect card or bank details.',
      'The app does not establish a complete policy for data retention or deletion, hosting regions, analytics or tracking, other third-party processing, or how people can make privacy requests. These details need owner confirmation before a final privacy policy is published.',
    ],
  },
  {
    id: 'partners',
    title: 'PARTNERS',
    paragraphs: [
      'Potential campaign, community, and distribution partners could help campaigners shape clear messages, connect with relevant communities, or make distribution possible when suitable services are arranged.',
      'Partnerships described here are possibilities, not confirmed relationships. The current app does not identify a confirmed partner, endorsement, or distribution agreement. Any future partner should be named only after its role and agreement have been verified.',
    ],
  },
  {
    id: 'help',
    title: 'HELP',
    paragraphs: [
      'Explore campaigns to find a message that interests you. Open a campaign to read its story, creator information, funding goal, proposed audience, and distribution plan. Treat proposed reach and performance figures as estimates, not delivered results.',
      'To create a campaign, sign in when account services are available, complete the campaign details, and save a draft or submit it for review. Drafts are saved on your device; submission reaches the SIGNAL API only when it is configured and the app confirms the sync. Check the status shown in the app before assuming a reviewer has received it.',
      'You can open a campaign’s contribution flow to review an amount and its funding progress. The current flow is simulated: confirming it does not charge you or send money. Progress and potential reach in this flow are illustrative; measured distribution results are not currently available.',
    ],
  },
  {
    id: 'contact',
    title: 'CONTACT',
    paragraphs: [
      'Official SIGNAL support contact details have not been configured in this app yet. A verified email address or other support destination needs to be added before users can contact the team.',
    ],
  },
  {
    id: 'community-guidelines',
    title: 'COMMUNITY GUIDELINES',
    paragraphs: [
      'Share truthful campaign information. Make clear what is confirmed, what is a proposal, and what is an estimate. Do not make misleading claims about a campaign, its funding, its reach, or its results.',
      'Do not impersonate another person or organization, make fraudulent fundraising claims, or use SIGNAL to harass, threaten, or promote hate against others. Communicate respectfully, and do not publish private information about someone else without permission.',
      'Campaign content may be reviewed. Content that violates these standards may be restricted or removed. The app does not currently describe a separate appeal process or guarantee a particular enforcement outcome.',
    ],
  },
] as const;

export default function InformationScreen() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  const scrollRef = useRef<ScrollView>(null);
  const sectionOffsets = useRef<Record<string, number>>({});
  const activeSection = informationSections.find((item) => item.id === section) ?? informationSections[0];

  const scrollToStory = () => {
    const offset = sectionOffsets.current['our-story'];
    if (offset !== undefined) scrollRef.current?.scrollTo({ y: offset, animated: true });
  };

  useEffect(() => {
    const offset = sectionOffsets.current[activeSection.id];
    if (offset !== undefined) scrollRef.current?.scrollTo({ y: offset, animated: false });
  }, [activeSection.id]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content} showsVerticalScrollIndicator>
        <View style={styles.contentColumn}>
          <Pressable accessibilityRole="button" onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/' as never); }} style={styles.backButton}>
            <Text style={styles.backText}>‹  Back</Text>
          </Pressable>
        </View>
        <View
          nativeID="about"
          onLayout={(event) => {
            const offset = event.nativeEvent.layout.y;
            sectionOffsets.current.about = offset;
            if (activeSection.id === 'about') scrollRef.current?.scrollTo({ y: offset, animated: false });
          }}
          style={styles.aboutWrap}>
          <View style={styles.contentColumn}>
            <View style={styles.aboutMasthead}>
              <Text style={styles.brand}>SIGNAL</Text>
              <Text style={styles.aboutKicker}>ABOUT / 01</Text>
            </View>
            <View style={styles.aboutHero}>
              <View style={styles.heroTextColumn}>
                <Text accessibilityRole="header" nativeID="about-heading" style={styles.heroTitle}>Why We{ '\n' }Exist.</Text>
                <Text style={styles.heroIntro}>The world doesn’t lack people who care. It lacks ways for their voices to reach the people who can act.</Text>
                <Pressable accessibilityRole="link" onPress={scrollToStory} style={styles.storyLink}>
                  <Text style={styles.storyLinkText}>OUR STORY  ↘</Text>
                </Pressable>
              </View>
              <View style={styles.heroImageCard}>
                <Image source={require('@/assets/images/stories/library-sharing.png')} style={styles.heroImage} contentFit="cover" contentPosition="center" accessibilityLabel="Children reading together around a book in a library" />
                <View style={styles.imageCaptionScrim}>
                  <Text style={styles.imageCaption}>A voice deserves a way forward.</Text>
                </View>
              </View>
            </View>
            <View style={styles.aboutDivider} />
            <View
              nativeID="our-story"
              onLayout={(event) => { sectionOffsets.current['our-story'] = event.nativeEvent.layout.y; }}
              style={styles.storyRows}>
              <AboutStoryRow number="01" title="Our purpose">
                SIGNAL helps people discover campaigns and come together to fund the distribution of campaign messages.
              </AboutStoryRow>
              <AboutStoryRow number="02" title="What contributions support">
                Contributions are intended to support amplification so a message can reach a wider audience; they are not direct charitable donations to the cause named in a campaign.
              </AboutStoryRow>
            </View>
          </View>
        </View>

        {informationSections.slice(1).map((item) => {
          const isCard = item.id === 'partners' || item.id === 'contact';
          return (
            <View
              key={item.id}
              nativeID={item.id}
              onLayout={(event) => {
                const offset = event.nativeEvent.layout.y;
                sectionOffsets.current[item.id] = offset;
                if (item.id === activeSection.id) scrollRef.current?.scrollTo({ y: offset, animated: false });
              }}>
              {isCard ? <View style={styles.cardDividerWrap}><View style={styles.cardDivider} /></View> : null}
              <View style={isCard ? styles.cardSectionOuter : undefined}>
                <View style={[styles.section, isCard ? styles.cardSection : styles.contentColumn, !isCard && item.id !== 'help' && item.id !== 'community-guidelines' && styles.separatedSection, item.id === 'partners' && styles.partnersCard, item.id === 'contact' && styles.contactCard]}>
                  <Text accessibilityRole="header" nativeID={`${item.id}-heading`} style={[styles.sectionTitle, item.id === 'partners' && styles.partnerTitle]}>{item.title}</Text>
                  {item.id === 'contact' ? <View style={styles.contactDetails}>
                    <ContactDetail label="Email" value="hello@signal-demo.example" />
                    <ContactDetail label="Phone" value="+1 (555) 010-2026" />
                    <ContactDetail label="Address" value="123 Demo Street, Sample City" />
                    <Text style={styles.contactPlaceholder}>These are fictional placeholders for demonstration purposes only and are not real contact information.</Text>
                    {item.paragraphs.map((paragraph, paragraphIndex) => <Text key={paragraphIndex} style={[styles.sectionCopy, styles.contactNote, paragraphIndex > 0 && styles.followingParagraph]}>{paragraph}</Text>)}
                  </View> : item.paragraphs.map((paragraph, paragraphIndex) => (
                    <Text key={paragraphIndex} style={[styles.sectionCopy, item.id === 'partners' && styles.partnerCopy, paragraphIndex > 0 && styles.followingParagraph]}>{paragraph}</Text>
                  ))}
                </View>
              </View>
              {isCard ? <View style={styles.cardDividerWrap}><View style={styles.cardDivider} /></View> : null}
            </View>
          );
        })}
        <View style={styles.taglineWrap}>
          <Text style={styles.tagline}>Small signals. Wider circles.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AboutStoryRow({ number, title, children }: { number: string; title: string; children: string }) {
  return (
    <View style={styles.storyRow}>
      <Text style={styles.storyNumber}>{number}</Text>
      <View style={styles.storyText}>
        <Text accessibilityRole="header" style={styles.storyTitle}>{title}</Text>
        <Text style={styles.sectionCopy}>{children}</Text>
      </View>
    </View>
  );
}

function ContactDetail({ label, value }: { label: string; value: string }) {
  return <View style={styles.contactDetailRow}><Text style={styles.contactLabel}>{label}</Text><Text style={styles.sectionCopy}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Signal.paper },
  content: { paddingTop: 12, paddingBottom: 44, width: '100%' },
  contentColumn: { width: '100%', maxWidth: 680, paddingHorizontal: 22, alignSelf: 'center' },
  backButton: { alignSelf: 'flex-start', minHeight: 42, justifyContent: 'center', paddingRight: 14, marginBottom: 2 },
  backText: { color: Signal.forest, fontFamily: SignalFonts.sans, fontSize: 13, fontWeight: '700' },
  aboutWrap: { width: '100%', paddingTop: 12, paddingBottom: 20 },
  aboutMasthead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Signal.hairline, paddingBottom: 11, marginBottom: 20 },
  brand: { color: Signal.ink, fontFamily: SignalFonts.display, fontSize: 15, lineHeight: 20, letterSpacing: 1.2, fontWeight: '700' },
  aboutKicker: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, fontSize: 11, lineHeight: 16, letterSpacing: 1.1, fontWeight: '600' },
  aboutHero: { width: '100%', flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  heroTextColumn: { flex: 1, minWidth: 0, justifyContent: 'flex-start' },
  heroTitle: { color: Signal.ink, fontFamily: SignalFonts.display, fontSize: 34, lineHeight: 37, fontWeight: '700', letterSpacing: -0.8, marginBottom: 20 },
  heroIntro: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, fontSize: 14, lineHeight: 21 },
  storyLink: { alignSelf: 'flex-start', paddingVertical: 12, marginTop: 'auto' },
  storyLinkText: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, fontSize: 11, lineHeight: 16, letterSpacing: 0.7, fontWeight: '600' },
  heroImageCard: { width: '47%', minHeight: 294, borderRadius: 10, overflow: 'hidden', backgroundColor: Signal.paperDeep, position: 'relative' },
  heroImage: { width: '100%', height: '100%', position: 'absolute', inset: 0 },
  imageCaptionScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 13, paddingVertical: 14, backgroundColor: 'rgba(21, 24, 22, 0.66)' },
  imageCaption: { color: Signal.onDark, fontFamily: SignalFonts.sans, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  aboutDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#000000', marginTop: 20 },
  storyRows: { paddingTop: 4 },
  storyRow: { flexDirection: 'row', gap: 14, paddingVertical: 17, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Signal.hairline },
  storyNumber: { color: Signal.ink, fontFamily: SignalFonts.display, fontSize: 22, lineHeight: 28, minWidth: 36 },
  storyText: { flex: 1, minWidth: 0 },
  storyTitle: { color: Signal.ink, fontFamily: SignalFonts.sans, fontSize: 17, lineHeight: 23, fontWeight: '700', marginBottom: 7 },
  section: { paddingTop: 22, paddingBottom: 22 },
  separatedSection: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#000000' },
  cardSectionOuter: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 18, marginTop: 14, marginBottom: 6 },
  cardSection: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 18 },
  cardDividerWrap: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 22, marginVertical: 14 },
  cardDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#000000' },
  partnersCard: { backgroundColor: Signal.maroon, borderRadius: 10 },
  partnerTitle: { color: Signal.paper },
  partnerCopy: { color: Signal.paper },
  contactCard: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#000000', borderRadius: 8 },
  contactDetails: { gap: 12 },
  contactDetailRow: { gap: 2 },
  contactLabel: { color: Signal.ink, fontFamily: SignalFonts.sans, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  contactPlaceholder: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, fontSize: 12, lineHeight: 18, fontStyle: 'italic', marginTop: 2 },
  contactNote: { marginTop: 2 },
  sectionTitle: { color: Signal.maroon, fontFamily: SignalFonts.sans, fontSize: 15, lineHeight: 21, fontWeight: '700', letterSpacing: 1.1, marginBottom: 8 },
  sectionCopy: { color: Signal.ink, fontFamily: SignalFonts.sans, fontSize: 14, lineHeight: 22 },
  followingParagraph: { marginTop: 10 },
  taglineWrap: { width: '100%', alignItems: 'center', paddingHorizontal: 22, marginTop: 25, marginBottom: 4 },
  tagline: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, fontSize: 13, lineHeight: 20, letterSpacing: 0.6, textAlign: 'center' },
});
