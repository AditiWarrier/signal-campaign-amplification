import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Signal, SignalFonts, SignalType } from '@/constants/theme';
import { parseUsdMinor } from '@/data/funding';
import type { HomeCampaign } from '@/data/home-demo';

const CARD_GAP = 14;

type DemoTotals = Record<string, { amountMinor: number; count: number }>;

type Props = {
  campaigns: HomeCampaign[];
  demoTotals: DemoTotals;
  signedIn: boolean;
  windowWidth: number;
  columnWidth: number;
  gutter: number;
};

function formatUsd(value: number) {
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function CampaignCard({ campaign, width, demoRaisedMinor, signedIn }: { campaign: HomeCampaign; width: number; demoRaisedMinor: number; signedIn: boolean }) {
  const raisedMinor = Math.min(Number.MAX_SAFE_INTEGER, parseUsdMinor(campaign.raised) + demoRaisedMinor);
  const goalMinor = parseUsdMinor(campaign.goal);
  const progress = goalMinor > 0 ? Math.min(raisedMinor / goalMinor, 1) : 0;
  const percent = Math.round(progress * 100);

  return (
    <View style={[s.card, { width }]}>
      <Image
        source={campaign.image}
        style={[s.cover, { width, height: width * 0.86 }]}
        contentFit="cover"
        accessibilityLabel={`Cover photo for ${campaign.title}`}
      />
      <View style={s.body}>
        <Text style={s.category}>{campaign.category.toUpperCase()}</Text>
        <Text style={s.title} numberOfLines={2}>{campaign.title}</Text>
        <Text style={s.creator} numberOfLines={1}>By {campaign.creator}</Text>
        <Text style={s.summary} numberOfLines={3}>{campaign.summary}</Text>

        <View style={s.moneyRow}>
          <Text style={s.money}>{formatUsd(raisedMinor / 100)}</Text>
          <Text style={s.goal}>raised of {formatUsd(campaign.goal)}</Text>
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={`${percent}% of demo funding goal`}
          accessibilityValue={{ min: 0, max: 100, now: percent }}
          style={s.track}>
          <View style={[s.fill, { width: `${progress * 100}%` }]} />
        </View>
        <View style={s.metaRow}>
          <Text style={s.meta}>{percent}% funded</Text>
          <Text style={s.meta}>
            Est. reach <Text style={s.metaStrong}>~{campaign.reach.toLocaleString('en-US')}</Text>
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Back This Campaign: ${campaign.title}. Demo only, no payment is taken.`}
          accessibilityHint={signedIn ? undefined : 'Sign in to back this campaign'}
          style={({ pressed }) => [s.button, pressed && s.pressed]}
          onPress={() => (signedIn
            ? router.push({ pathname: '/campaign/[id]', params: { id: campaign.id } } as never)
            : router.push('/login'))}>
          <Text style={s.buttonText}>Back This Campaign</Text>
          <Text style={s.buttonText}>{'→'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function WorldCampaigns({ campaigns, demoTotals, signedIn, windowWidth, columnWidth, gutter }: Props) {
  const inset = Math.max(gutter, (windowWidth - columnWidth) / 2 + gutter);
  const cardWidth = Math.min(Math.round((columnWidth - gutter * 2) * 0.84), 340);

  return (
    <View style={s.section}>
      <View style={[s.head, { paddingHorizontal: inset }]}>
        <Text accessibilityRole="header" style={s.heading}>Campaigns Around the World</Text>
        <Text style={s.lede}>Local causes looking for a wider audience. Figures shown are demo values.</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={cardWidth + CARD_GAP}
        snapToAlignment="start"
        contentContainerStyle={[s.row, { paddingHorizontal: inset }]}>
        {campaigns.map((campaign) => (
          <CampaignCard
            key={campaign.id}
            campaign={campaign}
            width={cardWidth}
            signedIn={signedIn}
            demoRaisedMinor={demoTotals[campaign.id]?.amountMinor ?? 0}
          />
        ))}
      </ScrollView>
      <View style={[s.footRow, { paddingHorizontal: inset }]}>
        <Pressable accessibilityRole="link" onPress={() => router.push('/explore')} hitSlop={8} style={s.linkHit}>
          <Text style={s.link}>{'See all campaigns →'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  section: { backgroundColor: Signal.charcoal, paddingTop: 52, paddingBottom: 36, marginTop: 56, width: '100%' },
  head: { marginBottom: 22, gap: 8 },
  heading: { color: Signal.onDark, fontFamily: SignalFonts.display, ...SignalType.sectionTitle },
  lede: { color: Signal.onDarkSoft, fontFamily: SignalFonts.sans, ...SignalType.small },
  row: { gap: CARD_GAP },
  pressed: { opacity: 0.7 },

  card: { borderRadius: 4, overflow: 'hidden', backgroundColor: '#1E221F', borderWidth: StyleSheet.hairlineWidth, borderColor: Signal.charcoalLine },
  cover: { backgroundColor: Signal.charcoalLine },
  body: { padding: 16 },
  category: { color: '#8FC2A0', fontFamily: SignalFonts.sans, fontSize: 11, lineHeight: 14, letterSpacing: 1.4, fontWeight: '700' },
  title: { color: Signal.onDark, fontFamily: SignalFonts.display, fontSize: 21, lineHeight: 26, marginTop: 6 },
  creator: { color: Signal.onDarkSoft, fontFamily: SignalFonts.sans, fontSize: 13, lineHeight: 18, marginTop: 4 },
  summary: { color: '#D6D9D1', fontFamily: SignalFonts.sans, fontSize: 14, lineHeight: 20, marginTop: 10 },

  moneyRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 16, marginBottom: 8 },
  money: { color: Signal.onDark, fontFamily: SignalFonts.sans, fontSize: 17, fontWeight: '700' },
  goal: { color: Signal.onDarkSoft, fontFamily: SignalFonts.sans, fontSize: 13 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: Signal.charcoalLine },
  fill: { height: 4, borderRadius: 2, backgroundColor: '#6FAF85' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  meta: { color: Signal.onDarkSoft, fontFamily: SignalFonts.sans, fontSize: 12, lineHeight: 17 },
  metaStrong: { color: Signal.onDark, fontWeight: '700' },

  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 46, borderRadius: 23, marginTop: 16, backgroundColor: Signal.onDark },
  buttonText: { color: Signal.ink, fontFamily: SignalFonts.sans, fontSize: 15, fontWeight: '700' },

  footRow: { marginTop: 14, alignItems: 'flex-start' },
  linkHit: { minHeight: 44, justifyContent: 'center' },
  link: { color: '#9CC4DF', fontFamily: SignalFonts.sans, fontSize: 15, fontWeight: '700' },
});
