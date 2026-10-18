import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Signal, SignalFonts, SignalType } from '@/constants/theme';
import { monthlyWin, moreMonthlyWins } from '@/data/home-demo';

export function MonthlyWins() {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={s.section}>
      <Text accessibilityRole="header" style={s.title}>Monthly Wins</Text>
      <Text style={s.caption}>Small moments from campaigns this month.</Text>

      <Image source={monthlyWin.image} style={s.image} contentFit="cover" accessibilityLabel="Neighbors looking at a newly painted community mural" />
      <Text style={s.eyebrow}>{monthlyWin.month.toUpperCase()}</Text>
      <Text style={s.storyTitle}>{monthlyWin.title}</Text>
      <Text style={s.story}>{monthlyWin.summary}</Text>

      {expanded && (
        <View style={s.more}>
          {moreMonthlyWins.map((win) => (
            <View key={win.title} style={s.moreItem}>
              <Text style={s.moreTitle}>{win.title}</Text>
              <Text style={s.moreCopy}>{win.summary}</Text>
            </View>
          ))}
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        hitSlop={8}
        style={s.linkHit}>
        <Text style={s.link}>{expanded ? 'Show less' : 'Explore This Month\u2019s Wins →'}</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  section: { paddingTop: 56 },
  title: { color: Signal.ink, fontFamily: SignalFonts.display, ...SignalType.sectionTitle },
  caption: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, ...SignalType.small, marginTop: 6, marginBottom: 18 },
  image: { width: '100%', aspectRatio: 16 / 10, borderRadius: 4, backgroundColor: Signal.paperDeep },
  eyebrow: { color: Signal.forest, fontFamily: SignalFonts.sans, ...SignalType.eyebrow, marginTop: 16 },
  storyTitle: { color: Signal.ink, fontFamily: SignalFonts.display, fontSize: 22, lineHeight: 28, marginTop: 6 },
  story: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, ...SignalType.small, marginTop: 6 },
  more: { marginTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Signal.hairline },
  moreItem: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Signal.hairline },
  moreTitle: { color: Signal.ink, fontFamily: SignalFonts.sans, fontSize: 15, fontWeight: '700' },
  moreCopy: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, fontSize: 14, lineHeight: 20, marginTop: 3 },
  linkHit: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start', marginTop: 8 },
  link: { color: Signal.lake, fontFamily: SignalFonts.sans, fontSize: 15, fontWeight: '700' },
});
