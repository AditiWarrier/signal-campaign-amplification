import { router, useLocalSearchParams } from 'expo-router';
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
          style={[styles.contentColumn, styles.aboutHeading]}>
          <Text accessibilityRole="header" nativeID="about-heading" style={styles.sectionTitle}>ABOUT SIGNAL</Text>
        </View>

        <AboutFeatures />

        <View style={styles.aboutCopyColumn}>
          <Text style={styles.sectionCopy}>{informationSections[0].paragraphs[0]}</Text>
        </View>

        {informationSections.slice(1).map((item) => (
          <View
            key={item.id}
            nativeID={item.id}
            onLayout={(event) => {
              const offset = event.nativeEvent.layout.y;
              sectionOffsets.current[item.id] = offset;
              if (item.id === activeSection.id) scrollRef.current?.scrollTo({ y: offset, animated: false });
            }}
            style={[styles.section, styles.contentColumn, styles.separatedSection]}>
            <Text accessibilityRole="header" nativeID={`${item.id}-heading`} style={styles.sectionTitle}>{item.title}</Text>
            {item.paragraphs.map((paragraph, paragraphIndex) => (
              <Text key={paragraphIndex} style={[styles.sectionCopy, paragraphIndex > 0 && styles.followingParagraph]}>{paragraph}</Text>
            ))}
          </View>
        ))}
        <View style={styles.taglineWrap}>
          <Text style={styles.tagline}>Small signals. Wider circles.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AboutFeatures() {
  return (
    <View>
      <View style={[styles.featureSection, styles.reportSection]}>
        <View accessible accessibilityLabel="Illustration of a report showing distribution progress" style={styles.featureContent}>
          <View style={styles.illustrationFrame}>
            <View style={styles.reportPage}>
              <View style={styles.reportHeadingLine} />
              <View style={styles.reportLine} />
              <View style={styles.reportChart}>
                <View style={styles.reportBarShort} />
                <View style={styles.reportBarMedium} />
                <View style={styles.reportBarTall} />
                <View style={styles.reportBarMedium} />
              </View>
            </View>
          </View>
          <View style={styles.featureCopy}>
            <Text accessibilityRole="header" style={styles.featureTitle}>Transparent Amplification</Text>
            <Text style={styles.featureDescription}>Understand what campaign funding supports and how distribution progress is reported.</Text>
          </View>
        </View>
      </View>

      <View style={[styles.featureSection, styles.reachSection]}>
        <View accessible accessibilityLabel="Illustration of a megaphone" style={styles.featureContent}>
          <View style={styles.illustrationFrame}>
            <View style={styles.megaphone}>
              <View style={styles.megaphoneGrip} />
              <View style={styles.megaphoneCone} />
              <View style={styles.megaphoneHandle} />
              <View style={styles.megaphoneWaveSmall} />
              <View style={styles.megaphoneWaveLarge} />
            </View>
          </View>
          <View style={styles.featureCopy}>
            <Text accessibilityRole="header" style={styles.featureTitle}>Wider Reach</Text>
            <Text style={styles.featureDescription}>Help meaningful campaign messages reach audiences beyond their existing networks.</Text>
          </View>
        </View>
      </View>

      <View style={[styles.featureSection, styles.impactSection]}>
        <View accessible accessibilityLabel="Illustration of a community group" style={styles.featureContent}>
          <View style={[styles.illustrationFrame, styles.peopleIllustration]}>
            <View style={styles.personSide}>
              <View style={styles.personHead} />
              <View style={styles.personBody} />
            </View>
            <View style={[styles.personSide, styles.personTall]}>
              <View style={styles.personHead} />
              <View style={styles.personBody} />
            </View>
            <View style={[styles.personSide, styles.personCenter]}>
              <View style={[styles.personHead, styles.personHeadCenter]} />
              <View style={[styles.personBody, styles.personBodyCenter]} />
            </View>
            <View style={[styles.personSide, styles.personTall]}>
              <View style={styles.personHead} />
              <View style={styles.personBody} />
            </View>
            <View style={styles.personSide}>
              <View style={styles.personHead} />
              <View style={styles.personBody} />
            </View>
          </View>
          <View style={styles.featureCopy}>
            <Text accessibilityRole="header" style={styles.featureTitle}>Impact Creation</Text>
            <Text style={styles.featureDescription}>Bring people together to help important messages reach more people.</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Signal.paper },
  content: { paddingTop: 12, paddingBottom: 44, width: '100%' },
  contentColumn: { width: '100%', maxWidth: 680, paddingHorizontal: 22, alignSelf: 'center' },
  backButton: { alignSelf: 'flex-start', minHeight: 42, justifyContent: 'center', paddingRight: 14, marginBottom: 2 },
  backText: { color: Signal.forest, fontFamily: SignalFonts.sans, fontSize: 13, fontWeight: '700' },
  aboutHeading: { paddingTop: 12, paddingBottom: 14 },
  aboutCopyColumn: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 20, paddingBottom: 24 },
  section: { paddingTop: 22, paddingBottom: 22 },
  separatedSection: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#000000' },
  sectionTitle: { color: Signal.maroon, fontFamily: SignalFonts.sans, fontSize: 15, lineHeight: 21, fontWeight: '700', letterSpacing: 1.1, marginBottom: 8 },
  sectionCopy: { color: Signal.ink, fontFamily: SignalFonts.sans, fontSize: 14, lineHeight: 22 },
  followingParagraph: { marginTop: 10 },
  featureSection: { width: '100%', paddingHorizontal: 22, paddingVertical: 25 },
  reportSection: { backgroundColor: Signal.paperDeep },
  reachSection: { backgroundColor: Signal.paper },
  impactSection: { backgroundColor: Signal.maroonLight },
  featureContent: { width: '100%', maxWidth: 680, alignSelf: 'center', alignItems: 'center' },
  illustrationFrame: { width: '100%', height: 150, alignItems: 'center', justifyContent: 'center' },
  featureCopy: { width: '100%', maxWidth: 520, alignItems: 'center', marginTop: 9 },
  featureTitle: { color: Signal.maroon, fontFamily: SignalFonts.sans, fontSize: 21, lineHeight: 27, fontWeight: '700', textAlign: 'center' },
  featureDescription: { color: Signal.ink, fontFamily: SignalFonts.sans, fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 6 },
  reportPage: { width: 98, height: 122, borderWidth: 2, borderColor: Signal.forest, borderRadius: 7, backgroundColor: Signal.paper, paddingHorizontal: 11, paddingTop: 12, paddingBottom: 10 },
  reportHeadingLine: { width: '68%', height: 4, borderRadius: 2, backgroundColor: Signal.maroon, marginBottom: 8 },
  reportLine: { width: '88%', height: 3, borderRadius: 2, backgroundColor: Signal.forest, opacity: 0.45, marginBottom: 8 },
  reportChart: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', borderBottomWidth: 2, borderBottomColor: Signal.forest },
  reportBarShort: { width: 10, height: 19, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: Signal.forest },
  reportBarMedium: { width: 10, height: 33, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: Signal.maroon },
  reportBarTall: { width: 10, height: 48, borderTopLeftRadius: 3, borderTopRightRadius: 3, backgroundColor: Signal.forest },
  megaphone: { width: 166, height: 104, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  megaphoneGrip: { width: 14, height: 40, borderWidth: 4, borderColor: Signal.maroon, borderRightWidth: 0, borderTopLeftRadius: 8, borderBottomLeftRadius: 8 },
  megaphoneCone: { width: 0, height: 0, borderTopWidth: 42, borderBottomWidth: 42, borderLeftWidth: 76, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: Signal.forest },
  megaphoneHandle: { position: 'absolute', width: 18, height: 31, left: 43, top: 65, borderWidth: 4, borderColor: Signal.maroon, borderTopWidth: 0, borderBottomLeftRadius: 6, borderBottomRightRadius: 6 },
  megaphoneWaveSmall: { width: 12, height: 30, marginLeft: 7, borderRightWidth: 4, borderColor: Signal.maroon, borderLeftColor: 'transparent', borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRadius: 16 },
  megaphoneWaveLarge: { position: 'absolute', right: -2, width: 20, height: 54, borderRightWidth: 4, borderColor: Signal.maroon, borderLeftColor: 'transparent', borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRadius: 24 },
  peopleIllustration: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 7 },
  personSide: { width: 28, alignItems: 'center', gap: 7 },
  personTall: { marginBottom: 8 },
  personHead: { width: 22, height: 22, borderRadius: 11, backgroundColor: Signal.forest },
  personBody: { width: 30, height: 44, borderWidth: 4, borderColor: Signal.forest, borderTopLeftRadius: 15, borderTopRightRadius: 15, borderBottomWidth: 0 },
  personCenter: { width: 34 },
  personHeadCenter: { width: 28, height: 28, borderRadius: 14, backgroundColor: Signal.maroon },
  personBodyCenter: { width: 40, height: 56, borderColor: Signal.maroon, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  taglineWrap: { width: '100%', alignItems: 'center', paddingHorizontal: 22, marginTop: 25, marginBottom: 4 },
  tagline: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, fontSize: 13, lineHeight: 20, letterSpacing: 0.6, textAlign: 'center' },
});
