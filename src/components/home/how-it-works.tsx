import { StyleSheet, Text, View } from 'react-native';

import { Signal, SignalFonts, SignalType } from '@/constants/theme';

const steps = [
  ['01', 'Create', 'Tell the story, set a goal, and show what wider reach could mean.'],
  ['02', 'Review', 'We review every campaign for clarity, safety, and community fit.'],
  ['03', 'Amplify', 'When a campaign is ready, supporters help its message travel further.'],
] as const;

export function HowItWorks() {
  return (
    <View style={s.section}>
      <Text accessibilityRole="header" style={s.title}>How It Works</Text>
      {steps.map(([number, title, detail], index) => (
        <View key={number} style={[s.step, index === 0 && s.stepFirst]}>
          <Text style={s.number}>{number}</Text>
          <View style={s.text}>
            <Text style={s.stepTitle}>{title}</Text>
            <Text style={s.copy}>{detail}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  section: { paddingTop: 56 },
  title: { color: Signal.ink, fontFamily: SignalFonts.display, ...SignalType.sectionTitle, marginBottom: 18 },
  step: { flexDirection: 'row', gap: 16, paddingVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Signal.ink },
  stepFirst: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Signal.ink },
  number: { color: Signal.lake, fontFamily: SignalFonts.display, fontSize: 20, lineHeight: 24, width: 32 },
  text: { flex: 1 },
  stepTitle: { color: Signal.ink, fontFamily: SignalFonts.sans, fontSize: 17, fontWeight: '700', marginBottom: 4 },
  copy: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, ...SignalType.small },
});
