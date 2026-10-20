import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette as C } from '@/constants/theme';
import type { ContributionCampaign } from '@/data/contribution-campaign';

export function formatContributionMoney(amountMinor: number, currency: 'USD' | 'INR' = 'USD') {
  return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'en-IN', {
    style: 'currency', currency, maximumFractionDigits: 2,
  }).format(Math.max(0, amountMinor) / 100);
}

export function FlowPage({ title, subtitle, children, bottom }: { title: string; subtitle?: string; children?: ReactNode; bottom?: ReactNode }) {
  return <SafeAreaView style={styles.safe} edges={['top']}>
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <Text style={styles.brand}>SIGNAL</Text>
      <Text accessibilityRole="header" style={styles.pageTitle}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.flowBody}>{children}</View>
      {bottom ? <View style={styles.bottom}>{bottom}</View> : null}
    </ScrollView>
  </SafeAreaView>;
}

export function CampaignIdentity({ campaign }: { campaign: ContributionCampaign }) {
  const source = typeof campaign.cover === 'string' ? { uri: campaign.cover } : campaign.cover;
  return <View style={styles.campaignCard}>
    {source ? <Image source={source} contentFit="cover" accessibilityLabel={`${campaign.title} campaign cover`} style={styles.campaignImage} /> : <View style={[styles.campaignImage, styles.campaignImageFallback]}><Text style={styles.fallbackLabel}>SIGNAL CAMPAIGN</Text></View>}
    <View style={styles.campaignInfo}>
      <Text style={styles.campaignTitle}>{campaign.title}</Text>
      {campaign.summary ? <Text numberOfLines={3} style={styles.campaignSummary}>{campaign.summary}</Text> : null}
      <Text style={styles.campaignMeta}>{campaign.origin === 'catalog' ? 'Illustrative catalogue demo' : 'Campaign amplification contribution'}</Text>
    </View>
  </View>;
}

export function FlowCard({ children, title, style }: { children: ReactNode; title?: string; style?: object }) {
  return <View style={[styles.card, style]}>
    {title ? <Text accessibilityRole="header" style={styles.cardTitle}>{title}</Text> : null}
    {children}
  </View>;
}

export function FlowTextInput({ label, hint, style, containerStyle, ...props }: TextInputProps & { label: string; hint?: string; containerStyle?: ViewStyle }) {
  return <View style={[styles.inputBlock, containerStyle]}>
    <Text style={styles.inputLabel}>{label}</Text>
    <TextInput accessibilityLabel={label} placeholderTextColor={C.muted} style={[styles.input, style]} {...props} />
    {hint ? <Text style={styles.hint}>{hint}</Text> : null}
  </View>;
}

export function FlowButton({ title, onPress, disabled = false, secondary = false, accessibilityHint }: {
  title: string; onPress: () => void; disabled?: boolean; secondary?: boolean; accessibilityHint?: string;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityHint={accessibilityHint} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.buttonSecondary, disabled && styles.buttonDisabled, pressed && !disabled && styles.buttonPressed]}>
    <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{title}</Text>
  </Pressable>;
}

export function FlowOption({ title, selected, onPress, disabled = false }: { title: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.option, selected && styles.optionSelected, disabled && styles.buttonDisabled, pressed && !disabled && styles.buttonPressed]}>
    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{title}</Text>
  </Pressable>;
}

export function MoneyRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <View style={styles.moneyRow}>
    <Text style={[styles.moneyLabel, strong && styles.moneyStrong]}>{label}</Text>
    <Text style={[styles.moneyValue, strong && styles.moneyStrong]}>{value}</Text>
  </View>;
}

export function InfoNote({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'error' | 'success' }) {
  return <View accessibilityLiveRegion={tone === 'default' ? 'none' : 'polite'} style={[styles.note, tone === 'error' && styles.noteError, tone === 'success' && styles.noteSuccess]}>
    <Text style={styles.noteText}>{children}</Text>
  </View>;
}

export function FlowLink({ title, onPress }: { title: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={styles.linkButton}><Text style={styles.linkText}>{title}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  page: { width: '100%', maxWidth: 620, alignSelf: 'center', paddingHorizontal: 22, paddingTop: 17, paddingBottom: 40 },
  brand: { color: C.green, fontSize: 11, fontWeight: '800', letterSpacing: 2.4, marginBottom: 16 },
  pageTitle: { color: C.text, fontSize: 29, lineHeight: 36, letterSpacing: -0.5, fontWeight: '700' },
  subtitle: { color: C.muted, fontSize: 14, lineHeight: 21, marginTop: 7 },
  flowBody: { gap: 14, marginTop: 22 },
  bottom: { gap: 10, marginTop: 18 },
  campaignCard: { flexDirection: 'row', alignItems: 'stretch', gap: 13, overflow: 'hidden', borderRadius: 11, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line },
  campaignImage: { width: 92, minHeight: 112, backgroundColor: C.backgroundSelected },
  campaignImageFallback: { alignItems: 'center', justifyContent: 'center', padding: 8 },
  fallbackLabel: { color: C.green, fontSize: 9, fontWeight: '800', letterSpacing: 1.2, textAlign: 'center' },
  campaignInfo: { flex: 1, paddingVertical: 12, paddingRight: 12, justifyContent: 'center', gap: 5 },
  campaignTitle: { color: C.text, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  campaignSummary: { color: C.muted, fontSize: 12, lineHeight: 17 },
  campaignMeta: { color: C.green, fontSize: 10, fontWeight: '700', marginTop: 1 },
  card: { gap: 12, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, padding: 16 },
  cardTitle: { color: C.text, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  inputBlock: { gap: 6 },
  inputLabel: { color: C.text, fontSize: 13, fontWeight: '700' },
  input: { minHeight: 47, borderRadius: 8, borderWidth: 1, borderColor: C.line, paddingHorizontal: 13, color: C.text, backgroundColor: C.paper, fontSize: 15 },
  hint: { color: C.muted, fontSize: 11, lineHeight: 16 },
  button: { minHeight: 49, alignItems: 'center', justifyContent: 'center', borderRadius: 25, paddingHorizontal: 18, backgroundColor: C.green },
  buttonSecondary: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.green },
  buttonDisabled: { opacity: 0.48 },
  buttonPressed: { opacity: 0.78 },
  buttonText: { color: C.paper, fontSize: 14, fontWeight: '700' },
  buttonTextSecondary: { color: C.green },
  option: { flexGrow: 1, minWidth: 82, minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13, borderRadius: 9, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper },
  optionSelected: { borderColor: C.green, backgroundColor: C.backgroundSelected },
  optionText: { color: C.text, fontSize: 13, fontWeight: '600' },
  optionTextSelected: { color: C.green, fontWeight: '800' },
  moneyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 5 },
  moneyLabel: { color: C.muted, fontSize: 13, lineHeight: 18, flexShrink: 1 },
  moneyValue: { color: C.text, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  moneyStrong: { color: C.text, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  note: { borderRadius: 9, backgroundColor: C.backgroundSelected, padding: 12 },
  noteError: { backgroundColor: C.maroonLight },
  noteSuccess: { backgroundColor: C.backgroundSelected },
  noteText: { color: C.text, fontSize: 12, lineHeight: 18 },
  linkButton: { alignSelf: 'flex-start', minHeight: 42, justifyContent: 'center', paddingVertical: 8 },
  linkText: { color: C.green, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
});
