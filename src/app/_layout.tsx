import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AuthProvider, useAuth } from '@/auth/auth-context';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Colors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

function AppNavigator() {
  const { isLoading, session } = useAuth();
  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Home and Explore are public; account-only tabs are guarded in (tabs)/_layout. */}
      <Stack.Screen name="(tabs)" />
      {/* Explore's bundled campaign details are public; saved campaign access is checked in the detail route. */}
      <Stack.Screen name="campaign/[id]" />
      <Stack.Screen name="creator/[id]" />
      <Stack.Screen name="contribute" />
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const theme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: Colors.light.brown,
      background: Colors.light.background,
      card: Colors.light.backgroundElement,
      text: Colors.light.text,
      border: Colors.light.line,
      notification: Colors.light.green,
    },
  };
  return (
    <ThemeProvider value={theme}>
      <AuthProvider>
        <AnimatedSplashOverlay />
        <AppNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}
