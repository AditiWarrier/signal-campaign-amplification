import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette as C } from '@/constants/theme';
const titles: Record<string, string> = {
  explore: 'Explore campaigns',
  create: 'Start a campaign',
  activity: 'Your activity',
  profile: 'Your profile',
};

export function PlaceholderScreen({ section }: { section: keyof typeof titles }) {
  const title = titles[section];
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.wordmark}>SIGNAL<Text style={styles.dot}>.</Text></Text>
        <Text style={styles.eyebrow}>A PLACE FOR GOOD IDEAS</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.copy}>This part of SIGNAL is a placeholder while we shape the first version. Nothing is being funded or published yet.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/')} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          <Text style={styles.buttonText}>Back to Home</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  content: { flex: 1, paddingHorizontal: 26, justifyContent: 'center', maxWidth: 620, width: '100%', alignSelf: 'center' },
  wordmark: { color: C.text, letterSpacing: 3.2, fontSize: 18, fontWeight: '800', position: 'absolute', top: 18, left: 26 },
  dot: { color: C.text },
  eyebrow: { color: C.text, fontSize: 10, letterSpacing: 1.5, fontWeight: '700', marginBottom: 10 },
  title: { color: C.text, fontSize: 32, fontWeight: '600', letterSpacing: -0.7 },
  copy: { color: C.muted, fontSize: 15, lineHeight: 23, marginTop: 12, maxWidth: 420 },
  button: { marginTop: 24, height: 48, borderRadius: 7, backgroundColor: C.brown, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: 22 },
  buttonText: { color: C.espresso, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.72 },
});
