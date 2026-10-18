import { Redirect, useSegments } from 'expo-router';

import { useAuth } from '@/auth/auth-context';
import AppTabs from '@/components/app-tabs';

const ACCOUNT_ONLY_TABS = new Set(['create', 'activity', 'profile']);

export default function TabsLayout() {
  const { session } = useAuth();
  const segments = useSegments() as string[];
  const activeTab = segments[1];

  if (!session && activeTab && ACCOUNT_ONLY_TABS.has(activeTab)) {
    return <Redirect href="/login" />;
  }

  return <AppTabs signedIn={Boolean(session)} />;
}
