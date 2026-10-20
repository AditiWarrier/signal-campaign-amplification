import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Signal, SignalFonts } from '@/constants/theme';

const HERO_IMAGE = require('../../../assets/images/hero-community-signs.png');

export function HomeHero({ width }: { width: number }) {
  const photoHeight = Math.round(Math.min(width * 1.08, 520));
  const archRadius = width / 2;
  const headlineSize = Math.round(Math.min(52, Math.max(31, width * 0.102)));
  const lineHeight = Math.round(headlineSize * 1.08);

  return (
    <View style={styles.hero}>
      <Text
        accessibilityRole="header"
        accessibilityLabel="The World Can't Hear What It Can't See."
        style={[styles.headline, { maxWidth: width, fontSize: headlineSize, lineHeight }]}>
        {"The World Can't Hear"}
        {'\n'}
        <Text style={styles.headlineEmphasis}>{"What It Can't See."}</Text>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingTop: 8 },
  headline: { color: Signal.ink, fontFamily: SignalFonts.display, fontWeight: '400', letterSpacing: -0.5, textAlign: 'center', marginBottom: 22 },
  headlineEmphasis: { fontStyle: 'italic' },
  photo: { overflow: 'hidden', backgroundColor: Signal.paperDeep },
});
