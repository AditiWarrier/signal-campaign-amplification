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

        <FeatureBand />

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
      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureBand() {
  return (
    <View style={styles.featureBand}>
      <View style={styles.featureBandInner}>
        <View accessible accessibilityLabel="Report chart illustration. Transparent Amplification." style={styles.featureItem}>
          <View style={styles.illustrationFrame}>
            <View style={styles.reportPage}>
              <View style={styles.reportHeadingLine} />
              <View style={styles.reportChart}>
                <View style={styles.reportBarShort} />
                <View style={styles.reportBarMedium} />
                <View style={styles.reportBarTall} />
              </View>
            </View>
          </View>
          <Text style={styles.featureLabel}>Transparent Amplification</Text>
        </View>

        <View accessible accessibilityLabel="Megaphone illustration. Wider Reach." style={styles.featureItem}>
          <View style={styles.illustrationFrame}>
            <View style={styles.megaphone}>
              <View style={styles.megaphoneGrip} />
              <View style={styles.megaphoneCone} />
              <View style={styles.megaphoneHandle} />
              <View style={styles.megaphoneWaveSmall} />
              <View style={styles.megaphoneWaveLarge} />
            </View>
          </View>
          <Text style={styles.featureLabel}>Wider Reach</Text>
        </View>

        <View accessible accessibilityLabel="Community people illustration. Impact Creation." style={styles.featureItem}>
          <View style={[styles.illustrationFrame, styles.peopleIllustration]}>
            <View style={styles.personSide}>
              <View style={styles.personHead} />
              <View style={styles.personBody} />
            </View>
            <View style={[styles.personSide, styles.personCenter]}>
              <View style={[styles.personHead, styles.personHeadCenter]} />
              <View style={[styles.personBody, styles.personBodyCenter]} />
            </View>
            <View style={styles.personSide}>
              <View style={styles.personHead} />
              <View style={styles.personBody} />
            </View>
          </View>
          <Text style={styles.featureLabel}>Impact Creation</Text>
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
  featureBand: { width: '100%', backgroundColor: '#000000', paddingVertical: 18 },
  featureBandInner: { width: '100%', maxWidth: 680, alignSelf: 'center', flexDirection: 'row', paddingHorizontal: 14 },
  featureItem: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'flex-start', gap: 8 },
  illustrationFrame: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  featureLabel: { width: '100%', color: '#FFFFFF', fontFamily: SignalFonts.sans, fontSize: 11, lineHeight: 15, fontWeight: '600', textAlign: 'center' },
  reportPage: { width: 34, height: 40, borderWidth: 1.5, borderColor: Signal.paper, borderRadius: 3, paddingHorizontal: 4, paddingTop: 5, paddingBottom: 4 },
  reportHeadingLine: { width: '70%', height: 2, backgroundColor: Signal.paper, marginBottom: 5 },
  reportChart: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', borderBottomWidth: 1, borderBottomColor: Signal.paper },
  reportBarShort: { width: 4, height: 7, backgroundColor: Signal.oliveLight },
  reportBarMedium: { width: 4, height: 12, backgroundColor: Signal.maroonLight },
  reportBarTall: { width: 4, height: 18, backgroundColor: Signal.oliveLight },
  megaphone: { width: 44, height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  megaphoneGrip: { width: 5, height: 12, borderWidth: 1.5, borderColor: Signal.paper, borderRightWidth: 0, borderTopLeftRadius: 3, borderBottomLeftRadius: 3 },
  megaphoneCone: { width: 0, height: 0, borderTopWidth: 13, borderBottomWidth: 13, borderLeftWidth: 24, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderLeftColor: Signal.paper },
  megaphoneHandle: { position: 'absolute', width: 5, height: 9, left: 14, top: 25, borderWidth: 1.5, borderColor: Signal.paper, borderTopWidth: 0, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 },
  megaphoneWaveSmall: { width: 6, height: 12, marginLeft: 2, borderRightWidth: 1.5, borderColor: Signal.oliveLight, borderLeftColor: 'transparent', borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRadius: 8 },
  megaphoneWaveLarge: { position: 'absolute', right: -1, width: 10, height: 21, borderRightWidth: 1.5, borderColor: Signal.oliveLight, borderLeftColor: 'transparent', borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRadius: 12 },
  peopleIllustration: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  personSide: { width: 12, alignItems: 'center', gap: 3 },
  personHead: { width: 8, height: 8, borderRadius: 4, backgroundColor: Signal.paper },
  personBody: { width: 12, height: 14, borderWidth: 1.5, borderColor: Signal.paper, borderTopLeftRadius: 7, borderTopRightRadius: 7, borderBottomWidth: 0 },
  personCenter: { width: 14 },
  personHeadCenter: { width: 10, height: 10, borderRadius: 5, backgroundColor: Signal.oliveLight },
  personBodyCenter: { width: 14, height: 16, borderColor: Signal.oliveLight, borderTopLeftRadius: 8, borderTopRightRadius: 8 },
});
