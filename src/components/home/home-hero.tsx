import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Signal, SignalFonts } from '@/constants/theme';

const HERO_IMAGE = require('../../../assets/images/hero-community-signs.png');

export function HomeHero({ width }: { width: number }) {
  const photoHeight = Math.round(Math.min(width * 1.08, 520));
  const archRadius = width / 2;
  const headlineSize = Math.round(Math.min(46, Math.max(31, width * 0.098)));
  const lineHeight = Math.round(headlineSize * 1.08);

  return (
    <View style={styles.hero}>
      <Text
        accessibilityRole="header"
        accessibilityLabel="The World Can't Hear What It Can't See."
        style={[styles.headline, { fontSize: headlineSize, lineHeight }]}>
        {"The World Can't Hear"}
      </Text>

      <View
        style={[styles.photo, { width, height: photoHeight, borderTopLeftRadius: archRadius, borderTopRightRadius: archRadius }]}>
        <Image
          source={HERO_IMAGE}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          contentPosition="center"
          accessibilityLabel="Neighbors of all ages gathered outdoors in a park, holding hand-painted signs."
        />
        <Svg style={styles.scrim} width={width} height={photoHeight * 0.5} pointerEvents="none">
          <Defs>
            <LinearGradient id="hero-scrim" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={Signal.scrim} stopOpacity={0} />
              <Stop offset="0.55" stopColor={Signal.scrim} stopOpacity={0.45} />
              <Stop offset="1" stopColor={Signal.scrim} stopOpacity={0.78} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill="url(#hero-scrim)" />
        </Svg>
        <Text
          importantForAccessibility="no"
          accessibilityElementsHidden
          style={[styles.overlapLine, { fontSize: headlineSize, lineHeight }]}>
          {"What It Can't See."}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: 8 },
  headline: { color: Signal.ink, fontFamily: SignalFonts.display, fontWeight: '400', letterSpacing: -0.5, textAlign: 'center', marginBottom: 18 },
  photo: { overflow: 'hidden', backgroundColor: Signal.paperDeep, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', left: 0, bottom: 0 },
  overlapLine: { color: Signal.onDark, fontFamily: SignalFonts.display, fontStyle: 'italic', fontWeight: '400', letterSpacing: -0.5, textAlign: 'center', paddingHorizontal: 16, paddingBottom: 26 },
});
