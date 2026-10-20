import { Redirect, useSegments } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Palette as C } from '@/constants/theme';
import { useAuth } from '@/auth/auth-context';
import AppTabs from '@/components/app-tabs';

const ACCOUNT_ONLY_TABS = new Set(['create', 'activity', 'profile']);

export default function TabsLayout() {
  const { session, isLoading } = useAuth();
  const segments = useSegments() as string[];
  const activeTab = segments[1];

  if (isLoading && activeTab && ACCOUNT_ONLY_TABS.has(activeTab)) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={C.green} size="small" />
        <Text style={styles.loadingText}>Loading your account…</Text>
      </View>
    );
  }

  if (!isLoading && !session && activeTab && ACCOUNT_ONLY_TABS.has(activeTab)) {
    return <Redirect href="/login" />;
  }

  return <AppTabs signedIn={Boolean(session)} />;
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.paper },
  loadingText: { color: C.muted, fontSize: 13 },
});
