import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useWebScrollDiagnostics } from '@/hooks/use-web-scroll-diagnostics';
import { useAuth } from '@/auth/auth-context';

const C = {
  paper: '#EEE8DF',
  white: '#FFFEFA',
  ink: '#302A25',
  muted: '#776E65',
  line: '#E8E1D7',
  brown: '#74563F',
  brownLight: '#EDE5DA',
  green: '#536D58',
};

const settings = [
  { label: 'Edit Profile', symbol: { ios: 'person.crop.circle', android: 'account_circle', web: 'person' } },
  { label: 'Notifications', symbol: { ios: 'bell', android: 'notifications_none', web: 'notifications' } },
  { label: 'Privacy', symbol: { ios: 'hand.raised', android: 'shield', web: 'lock' } },
  { label: 'Help', symbol: { ios: 'questionmark.circle', android: 'help_outline', web: 'help' } },
] as const;

function SectionHeading({ children }: { children: string }) {
  return <Text style={styles.sectionHeading}>{children}</Text>;
}

function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
      {action}
    </View>
  );
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const [signOutError, setSignOutError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  useWebScrollDiagnostics(scrollRef, 'profile');
  const displayName = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email?.split('@')[0] ?? 'SIGNAL member';
  const initials = displayName.split(/\s+/).map((part) => part.charAt(0)).join('').slice(0, 2).toUpperCase();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
      >
        <Text style={styles.wordmark}>SIGNAL</Text>

        <View style={styles.profileCard}>
          <View style={styles.avatar} accessibilityLabel="Profile initials avatar">
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <View style={styles.status}>
              <Text style={styles.statusText}>Signed in</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeading>My Campaigns</SectionHeading>
          <EmptyState
            title="No campaigns created yet"
            description="No campaigns are linked to this account yet. The Create screen is a preview and does not submit campaigns."
            action={
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/create' as never)}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>Create Campaign</Text>
              </Pressable>
            }
          />
        </View>

        <View style={styles.section}>
          <SectionHeading>My Contributions</SectionHeading>
          <EmptyState
            title="No contribution activity"
            description="This demo does not record contributions or process payments. Any future contributions would support message distribution, not donate directly to a cause."
          />
        </View>

        <View style={styles.section}>
          <View style={styles.settingsHeading}>
            <SectionHeading>Account Settings</SectionHeading>
            <Text style={styles.previewNote}>Preview options</Text>
          </View>
          <View style={styles.settingsCard}>
            {settings.map((item, index) => (
              <View key={item.label} style={[styles.settingRow, index < settings.length - 1 && styles.settingDivider]}>
                <View style={styles.settingLeft}>
                  <SymbolView name={item.symbol} size={17} tintColor={C.brown} />
                  <Text style={styles.settingLabel}>{item.label}</Text>
                </View>
                <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={14} tintColor="#B4AA9D" />
              </View>
            ))}
          </View>
          {signOutError ? <Text style={styles.signOutError}>{signOutError}</Text> : null}
          <Pressable
            accessibilityRole="button"
            disabled={signingOut}
            onPress={async () => {
              setSigningOut(true);
              setSignOutError('');
              try { await signOut(); } catch { setSignOutError('Could not contact the sign-out service. Your local session has been cleared.'); }
              finally { setSigningOut(false); }
            }}
            style={({ pressed }) => [styles.signOutRow, pressed && styles.pressed]}
          >
            <SymbolView name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }} size={17} tintColor={C.muted} />
            <Text style={styles.signOutTitle}>{signingOut ? 'Signing Out…' : 'Sign Out'}</Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>Small signals. Wider circles.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, minHeight: 0, backgroundColor: C.paper },
  scroll: { flex: 1, minHeight: 0 },
  content: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 128, maxWidth: 680, width: '100%', alignSelf: 'center' },
  wordmark: { color: C.brown, letterSpacing: 2.4, fontSize: 11, fontWeight: '700', textAlign: 'center', marginBottom: 22 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 9 },
  avatar: { width: 62, height: 62, borderRadius: 31, backgroundColor: C.brownLight, borderWidth: 1, borderColor: '#DFD2C1', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.brown, fontSize: 19, fontWeight: '700', letterSpacing: 0.5 },
  profileCopy: { flex: 1, minWidth: 0 },
  name: { color: C.ink, fontSize: 21, lineHeight: 27, fontWeight: '600' },
  email: { color: C.muted, fontSize: 13, marginTop: 3 },
  status: { alignSelf: 'flex-start', backgroundColor: C.brownLight, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 5, marginTop: 10 },
  statusText: { color: C.brown, fontSize: 10, fontWeight: '700' },
  section: { marginTop: 31 },
  sectionHeading: { color: C.ink, fontSize: 23, lineHeight: 29, fontWeight: '600', letterSpacing: -0.35, marginBottom: 12 },
  emptyCard: { padding: 17, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 9 },
  emptyTitle: { color: C.ink, fontSize: 15, fontWeight: '700' },
  emptyDescription: { color: C.muted, fontSize: 12, lineHeight: 19, marginTop: 6 },
  primaryButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 17, marginTop: 15, backgroundColor: C.brown, borderRadius: 6 },
  primaryButtonText: { color: C.white, fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.72 },
  settingsCard: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 9, paddingHorizontal: 15 },
  settingRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  settingsHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  previewNote: { color: C.muted, fontSize: 10, marginBottom: 12 },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingDivider: { borderBottomWidth: 1, borderBottomColor: C.line },
  settingLabel: { color: C.ink, fontSize: 13, fontWeight: '600' },
  signOutRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, marginTop: 12, backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 9, opacity: 0.8 },
  signOutTitle: { color: C.muted, fontSize: 13, fontWeight: '600' },
  signOutError: { color: '#8A5140', fontSize: 11, lineHeight: 16, marginTop: 8 },
  footer: { color: C.brown, textAlign: 'center', fontSize: 12, letterSpacing: 0.7, marginTop: 32 },
});
