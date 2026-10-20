import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/auth-context';
import { Signal, SignalFonts, SignalType } from '@/constants/theme';

type MenuItem = { label: string; href: Href; requiresAccount: boolean };

const MENU_ITEMS: MenuItem[] = [
  { label: 'Home', href: '/', requiresAccount: false },
  { label: 'Explore Campaigns', href: '/explore', requiresAccount: false },
  { label: 'Create a Campaign', href: '/create', requiresAccount: true },
  { label: 'Activity', href: '/activity', requiresAccount: true },
  { label: 'Profile', href: '/profile', requiresAccount: true },
];

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <View style={styles.burger} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.burgerLine, open && styles.burgerLineTopOpen]} />
      {!open && <View style={styles.burgerLine} />}
      <View style={[styles.burgerLine, open && styles.burgerLineBottomOpen]} />
    </View>
  );
}

export function HomeHeader({ menuOnly = false }: { menuOnly?: boolean }) {
  const { session } = useAuth();
  const signedIn = Boolean(session);
  const [menuOpen, setMenuOpen] = useState(false);

  const navigate = (item: MenuItem) => {
    setMenuOpen(false);
    router.push(item.requiresAccount && !signedIn ? '/login' : item.href);
  };

  return (
    <View style={styles.header}>
      {menuOnly ? <View style={styles.headerSpacer} /> : <Text style={styles.wordmark} accessibilityRole="header">SIGNAL</Text>}
      <View style={styles.actions}>
        {!menuOnly && <Pressable
          accessibilityRole="button"
          accessibilityLabel={signedIn ? 'Open your profile' : 'Sign in or log in'}
          onPress={() => router.push(signedIn ? '/profile' : '/login')}
          hitSlop={6}
          style={({ pressed }) => [styles.signIn, pressed && styles.pressed]}>
          <Text style={styles.signInText}>{signedIn ? 'Account' : 'Sign in'}</Text>
        </Pressable>}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open navigation menu"
          accessibilityState={{ expanded: menuOpen }}
          onPress={() => setMenuOpen(true)}
          style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}>
          <HamburgerIcon open={false} />
        </Pressable>
      </View>

      <Modal visible={menuOpen} animationType="fade" transparent onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.sheet}>
          <SafeAreaView style={styles.sheetInner} edges={['top', 'bottom']}>
            <View style={styles.header}>
              <Text style={styles.wordmark}>SIGNAL</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close navigation menu"
                onPress={() => setMenuOpen(false)}
                style={({ pressed }) => [styles.menuButton, pressed && styles.pressed]}>
                <HamburgerIcon open />
              </Pressable>
            </View>

            <View style={styles.menuList} accessibilityRole="menu">
              {MENU_ITEMS.map((item, index) => (
                <Pressable
                  key={item.label}
                  accessibilityRole="menuitem"
                  accessibilityHint={item.requiresAccount && !signedIn ? 'Requires signing in' : undefined}
                  onPress={() => navigate(item)}
                  style={({ pressed }) => [styles.menuItem, index === 0 && styles.menuItemFirst, pressed && styles.menuItemPressed]}>
                  <Text style={styles.menuItemText}>{item.label}</Text>
                  {item.requiresAccount && !signedIn ? <Text style={styles.menuItemNote}>Sign in</Text> : <Text style={styles.menuArrow}>{'→'}</Text>}
                </Pressable>
              ))}
            </View>

            {!signedIn ? (
              <View style={styles.authRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => { setMenuOpen(false); router.push('/login'); }}
                  style={({ pressed }) => [styles.authPrimary, pressed && styles.pressed]}>
                  <Text style={styles.authPrimaryText}>Sign in</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => { setMenuOpen(false); router.push('/register'); }}
                  style={({ pressed }) => [styles.authSecondary, pressed && styles.pressed]}>
                  <Text style={styles.authSecondaryText}>Create account</Text>
                </Pressable>
              </View>
            ) : null}
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerSpacer: { flex: 1 },
  wordmark: { color: Signal.ink, fontFamily: SignalFonts.sans, fontSize: 20, lineHeight: 24, fontWeight: '900', letterSpacing: 5 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  signIn: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
  signInText: { color: Signal.ink, fontFamily: SignalFonts.sans, fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
  menuButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  burger: { width: 22, height: 16, justifyContent: 'space-between' },
  burgerLine: { height: 2, borderRadius: 1, backgroundColor: Signal.ink },
  burgerLineTopOpen: { transform: [{ translateY: 7 }, { rotate: '45deg' }] },
  burgerLineBottomOpen: { transform: [{ translateY: -7 }, { rotate: '-45deg' }] },
  pressed: { opacity: 0.6 },
  sheet: { flex: 1, backgroundColor: Signal.paper },
  sheetInner: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 20 },
  menuList: { marginTop: 28 },
  menuItem: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Signal.ink, paddingVertical: 14 },
  menuItemFirst: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Signal.ink },
  menuItemPressed: { backgroundColor: Signal.paperDeep },
  menuItemText: { color: Signal.ink, fontFamily: SignalFonts.display, fontSize: 26, lineHeight: 32 },
  menuItemNote: { color: Signal.inkSoft, fontFamily: SignalFonts.sans, ...SignalType.small },
  menuArrow: { color: Signal.forest, fontSize: 20 },
  authRow: { flexDirection: 'row', gap: 12, marginTop: 32 },
  authPrimary: { flex: 1, minHeight: 50, borderRadius: 25, backgroundColor: Signal.forest, alignItems: 'center', justifyContent: 'center' },
  authPrimaryText: { color: Signal.onDark, fontFamily: SignalFonts.sans, fontSize: 16, fontWeight: '700' },
  authSecondary: { flex: 1, minHeight: 50, borderRadius: 25, borderWidth: 1, borderColor: Signal.ink, alignItems: 'center', justifyContent: 'center' },
  authSecondaryText: { color: Signal.ink, fontFamily: SignalFonts.sans, fontSize: 16, fontWeight: '700' },
});
