import { StyleSheet, Text, View } from 'react-native';

import { Signal, SignalFonts, SignalType } from '@/constants/theme';

const steps = [
  {
    number: '01',
    title: 'Create a campaign',
    detail: 'Share your message, explain why it matters, and choose the audience and platforms you want to reach.',
  },
  {
    number: '02',
    title: 'Bring people together',
    detail: 'People discover your campaign and contribute towards its amplification goal, helping your message reach beyond your immediate community.',
  },
  {
    number: '03',
    title: 'Take your message further',
    detail: 'Funding can help your campaign reach larger audiences on platforms like Instagram and Facebook, bringing important issues to the attention of people and decision-makers who may be able to make a difference.',
  },
] as const;

export function HowItWorks() {
  return (
    <View style={s.section}>
      <Text style={s.eyebrow}>How It Works</Text>
      <Text style={s.subtitle}>
        SIGNAL helps campaigns reach wider audiences by bringing people together to support message amplification. SIGNAL does not collect donations for causes or distribute funds directly to charities. Contributions towards a campaign&apos;s amplification are intended to help its message reach more people.
      </Text>

      <View style={s.steps}>
        {steps.map(({ number, title, detail }, index) => {
          const reverse = index === 1;
          return (
            <View key={number} style={[s.step, reverse && s.stepReverse, index === 1 && s.stepMiddle, index === 2 && s.stepLast]}>
              <View style={s.badge}>
                <Text style={s.number}>{number}</Text>
              </View>
              <View style={[s.text, reverse && s.textRight]}>
                <Text style={s.stepTitle}>{title}</Text>
                <Text style={s.copy}>{detail}</Text>
              </View>
            </View>
          );
        })}
      </View>
      <Text style={s.disclaimer}>
        Actual distribution depends on campaign approval, available funding and delivery. Reach and outcomes are not guaranteed.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  section: { paddingTop: 56 },
  eyebrow: {
    color: '#1C211D',
    fontFamily: SignalFonts.display,
    fontSize: 28,
    lineHeight: 34,
    marginBottom: 12,
  },
  subtitle: {
    color: Signal.inkSoft,
    fontFamily: SignalFonts.sans,
    ...SignalType.body,
    marginBottom: 24,
  },
  steps: { gap: 12 },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 16,
    paddingVertical: 20,
    minHeight: 112,
    backgroundColor: Signal.paperDeep,
    borderWidth: 1,
    borderColor: Signal.hairline,
    borderLeftWidth: 3,
    borderLeftColor: Signal.maroon,
    borderRadius: 5,
  },
  stepReverse: { flexDirection: 'row-reverse', backgroundColor: Signal.paper, borderLeftWidth: 1, borderRightWidth: 3, borderRightColor: Signal.maroon },
  stepMiddle: { borderColor: Signal.hairline },
  stepLast: { backgroundColor: Signal.paperDeep },
  badge: {
    width: 46,
    height: 46,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
    backgroundColor: Signal.maroon,
  },
  number: { color: Signal.paper, fontFamily: SignalFonts.display, fontSize: 16, lineHeight: 20, fontWeight: '700' },
  text: { flex: 1, minWidth: 0 },
  textRight: { alignItems: 'flex-end' },
  stepTitle: { color: Signal.ink, fontFamily: SignalFonts.sans, fontSize: 17, lineHeight: 23, fontWeight: '700', marginBottom: 5 },
  copy: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, ...SignalType.small },
  disclaimer: {
    color: Signal.inkSoft,
    fontFamily: SignalFonts.sans,
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
    marginTop: 14,
  },
});
