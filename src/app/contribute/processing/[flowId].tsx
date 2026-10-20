import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { FlowButton, FlowPage, InfoNote } from '@/components/contributions/flow-ui';
import { processContributionFlow } from '@/data/contribution-processing';
import { readContributionFlow } from '@/data/contribution-flow';
import { Palette as C } from '@/constants/theme';

export default function ContributionProcessingScreen() {
  const { flowId } = useLocalSearchParams<{ flowId: string }>();
  const { user, session } = useAuth();
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const flow = await readContributionFlow(flowId ?? '');
        if (!flow) { if (active) { setMissing(true); setError('The saved demo checkout state could not be found. No successful contribution is shown.'); } return; }
        if (['success', 'rejected', 'failed', 'cancelled'].includes(flow.status)) {
          router.replace({ pathname: '/contribute/result/[flowId]', params: { flowId: flow.id } } as never);
          return;
        }
        if (!flow.outcome) {
          router.replace({ pathname: '/contribute/checkout/[flowId]', params: { flowId: flow.id } } as never);
          return;
        }
        const finalFlow = await processContributionFlow(flow, session?.access_token, user?.id);
        if (active) router.replace({ pathname: '/contribute/result/[flowId]', params: { flowId: finalFlow.id } } as never);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : 'The contribution status could not be confirmed.');
      }
    })();
    return () => { active = false; };
  }, [flowId, session?.access_token, user?.id]);

  return <FlowPage title="Confirming your contribution" subtitle="This is a demo status check. No payment provider is being contacted.">
    <View style={styles.processingCard}>
      <ActivityIndicator accessibilityLabel="Confirming the simulated contribution" size="large" color={C.green} />
      <Text accessibilityRole="header" style={styles.processingTitle}>Confirming your contribution…</Text>
      <Text style={styles.processingText}>Please wait while SIGNAL records the selected simulated outcome.</Text>
    </View>
    {error ? <InfoNote tone="error">{error}</InfoNote> : null}
    {missing ? <FlowButton title="Return to Explore" onPress={() => router.replace('/explore' as never)} /> : null}
  </FlowPage>;
}

const styles = StyleSheet.create({
  processingCard: { minHeight: 250, justifyContent: 'center', alignItems: 'center', gap: 18, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, padding: 28 },
  processingTitle: { color: C.text, fontSize: 20, lineHeight: 27, fontWeight: '700', textAlign: 'center' },
  processingText: { color: C.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', maxWidth: 330 },
});
