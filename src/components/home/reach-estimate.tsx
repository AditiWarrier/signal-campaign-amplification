import { StyleSheet, Text, View } from 'react-native';

import { Signal, SignalFonts, SignalType } from '@/constants/theme';

export function ReachEstimate({ reachPerDollar }: { reachPerDollar: number }) {
  return (
    <View style={styles.panel} accessibilityLabel={`Illustrative estimated reach per dollar: about ${reachPerDollar} potential views per dollar. Actual reach may vary and is not guaranteed.`}>
      <Text style={styles.eyebrow}>ESTIMATE</Text>
      <Text style={styles.heading}>Illustrative estimated reach per dollar</Text>
      <View style={styles.figureRow}>
        <Text style={styles.figure}>{`~${reachPerDollar}`}</Text>
        <Text style={styles.figureLabel}>potential views{'\n'}per dollar</Text>
      </View>
      <View style={styles.rule} />
      <Text style={styles.description}>Based on a configurable demo assumption.</Text>
      <Text style={styles.disclaimer}>Actual reach may vary and is not guaranteed.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { marginTop: 32, borderWidth: 1, borderColor: Signal.ink, paddingHorizontal: 20, paddingVertical: 20 },
  eyebrow: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, ...SignalType.eyebrow },
  heading: { color: Signal.ink, fontFamily: SignalFonts.sans, fontSize: 17, lineHeight: 23, fontWeight: '700', marginTop: 8 },
  figureRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 14 },
  figure: { color: '#2A5B7C', fontFamily: SignalFonts.display, fontSize: 56, lineHeight: 60 },
  figureLabel: { color: Signal.ink, fontFamily: SignalFonts.sans, ...SignalType.small },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: Signal.ink, marginTop: 16, marginBottom: 12 },
  description: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, ...SignalType.small },
  disclaimer: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, fontSize: 13, lineHeight: 19, marginTop: 4 },
});
