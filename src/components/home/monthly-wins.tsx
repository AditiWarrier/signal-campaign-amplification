import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Signal, SignalFonts, SignalType } from '@/constants/theme';

const CHILDREN_IMAGE = require('../../../assets/images/home-children.jpg');

export function MonthlyWins() {
  return (
    <View style={s.section}>
      <Text accessibilityRole="header" style={s.title}>Messages That Made It Out There: Our Monthly Wins!</Text>
      <Text style={s.caption}>
        Celebrating campaigns that reached their funding goals and took their messages further.
      </Text>

      <View style={s.imageFrame}>
        <Image
          source={CHILDREN_IMAGE}
          style={s.image}
          contentFit="cover"
          accessibilityLabel="A smiling group of children gathered together outdoors"
        />
        <View style={s.imageOverlay} pointerEvents="box-none">
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push('/wins')}
            style={({ pressed }) => [s.button, pressed && s.pressed]}>
            <Text style={s.buttonText}>Discover the Wins</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  section: { paddingTop: 56 },
  title: { color: Signal.ink, fontFamily: SignalFonts.display, ...SignalType.sectionTitle },
  caption: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, ...SignalType.small, marginTop: 6, marginBottom: 18 },
  imageFrame: { width: '100%', aspectRatio: 16 / 10, borderRadius: 4, overflow: 'hidden', backgroundColor: Signal.paperDeep },
  image: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  imageOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  button: { minHeight: 52, justifyContent: 'center', paddingHorizontal: 24, borderRadius: 26, backgroundColor: Signal.forest },
  buttonText: { color: Signal.onDark, fontFamily: SignalFonts.sans, fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.75 },
});
