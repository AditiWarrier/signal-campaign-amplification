import { StyleSheet, Text, View } from 'react-native';

import { Palette as C } from '@/constants/theme';
import { calculateFundingProgress, formatUsdMinor } from '@/data/funding';

type Props = {
  goalMinor: number;
  progressMinor: number;
  progressLabel: string;
  contributionCount?: number;
  verifiedRaisedMinor?: number;
  note: string;
};

function safeCount(value: number | undefined): number | undefined {
  return value !== undefined && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

export function FundingSummary({ goalMinor, progressMinor, progressLabel, contributionCount, verifiedRaisedMinor, note }: Props) {
  const progress = calculateFundingProgress(goalMinor, progressMinor);
  const count = safeCount(contributionCount);
  const verified = verifiedRaisedMinor === undefined ? undefined : verifiedRaisedMinor;

  return <View style={styles.card}>
    <View style={styles.headingRow}>
      <Text style={styles.title}>Funding summary</Text>
      {count !== undefined ? <Text style={styles.count}>{count} demo {count === 1 ? 'contribution' : 'contributions'}</Text> : null}
    </View>
    <View style={styles.valueRow}>
      <Text style={styles.label}>Funding goal</Text>
      <Text style={styles.value}>{progress.goalMinor > 0 ? formatUsdMinor(progress.goalMinor) : 'Not set'}</Text>
    </View>
    {verified !== undefined ? <View style={styles.valueRow}>
      <Text style={styles.label}>Verified funds received</Text>
      <Text style={styles.value}>{formatUsdMinor(verified)}</Text>
    </View> : null}
    <View style={styles.valueRow}>
      <Text style={styles.label}>{progressLabel}</Text>
      <Text style={styles.value}>{formatUsdMinor(progress.raisedMinor)}</Text>
    </View>
    <View style={styles.progressHeading}>
      <Text style={styles.label}>{progress.percentage === null ? 'Progress unavailable' : `Progress ${progress.percentage.toLocaleString('en-US', { maximumFractionDigits: 1 })}%`}</Text>
      <Text style={styles.label}>{progress.remainingMinor === null ? 'Remaining —' : `${formatUsdMinor(progress.remainingMinor)} remaining`}</Text>
    </View>
    <View accessibilityRole="progressbar" accessibilityLabel="Funding progress" accessibilityValue={progress.percentage === null ? undefined : { min: 0, max: 100, now: Math.round(progress.barPercentage) }} style={styles.track}>
      <View style={[styles.fill, { width: `${progress.barPercentage}%` }]} />
    </View>
    <Text style={styles.note}>{note}</Text>
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: C.line, borderRadius: 9, backgroundColor: C.surface, padding: 16, marginTop: 16, gap: 9 },
  headingRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  title: { color: C.text, fontSize: 16, lineHeight: 21, fontWeight: '700' },
  count: { color: C.muted, fontSize: 10, lineHeight: 15 },
  valueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  label: { flexShrink: 1, color: C.muted, fontSize: 12, lineHeight: 18 },
  value: { flexShrink: 0, color: C.text, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  progressHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginTop: 3 },
  track: { height: 8, borderRadius: 5, backgroundColor: C.surfaceSoft, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5, backgroundColor: C.green },
  note: { color: C.muted, fontSize: 10, lineHeight: 15 },
});
