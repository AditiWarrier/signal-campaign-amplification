import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { Signal, SignalFonts, SignalType } from '@/constants/theme';

export function ImportantMessages() {
  const { session } = useAuth();

  return (
    <View style={styles.section}>
      <View style={styles.eyebrowRow}>
        <View style={styles.marker} />
        <Text style={styles.eyebrow}>IMPORTANT MESSAGES</Text>
      </View>
      <Text style={styles.lead}>Important messages deserve to reach beyond their immediate circles.</Text>
      <Text style={styles.body}>
        Together, we fund their amplification across relevant platforms like Instagram and Facebook, helping more people discover the causes that matter and giving those messages a greater chance to inspire action.
      </Text>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/explore')}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
          <Text style={styles.primaryText}>Explore Campaigns</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityHint={session ? undefined : 'Sign in to start a campaign'}
          onPress={() => router.push(session ? '/create' : '/login')}
          style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
          <Text style={styles.secondaryText}>Start a Campaign</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 36 },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  marker: { width: 10, height: 10, backgroundColor: Signal.sun },
  eyebrow: { color: Signal.forest, fontFamily: SignalFonts.sans, ...SignalType.eyebrow },
  lead: { color: Signal.ink, fontFamily: SignalFonts.display, ...SignalType.lead },
  body: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, ...SignalType.body, marginTop: 14 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 24 },
  primary: { flexGrow: 1, flexBasis: 150, minHeight: 50, paddingHorizontal: 18, borderRadius: 25, backgroundColor: Signal.forest, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: Signal.onDark, fontFamily: SignalFonts.sans, fontSize: 15, fontWeight: '700' },
  secondary: { flexGrow: 1, flexBasis: 150, minHeight: 50, paddingHorizontal: 18, borderRadius: 25, borderWidth: 1, borderColor: Signal.ink, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: Signal.ink, fontFamily: SignalFonts.sans, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
