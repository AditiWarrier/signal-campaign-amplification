import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette as C } from '@/constants/theme';
import { useWebScrollDiagnostics } from '@/hooks/use-web-scroll-diagnostics';
import { useAuth } from '@/auth/auth-context';
import { readCampaignSubmissions } from '@/data/campaign-draft-storage';
import { formatUsdMinor } from '@/data/funding';
import { isSignalApiConfigured, getSignalActivityWithRefresh, listSubmittedCampaignsFromApi, type SignalActivityEvent } from '@/data/signal-api';
import { readOwnedLocalActivityEvents, type LocalActivityEvent } from '@/data/local-activity';
import type { LocalCampaignIndexEntry } from '@/types/local-campaign';

const settings = [
  { label: 'Edit Profile', symbol: { ios: 'person.crop.circle', android: 'account_circle', web: 'person' } },
  { label: 'Notifications', symbol: { ios: 'bell', android: 'notifications_none', web: 'notifications' } },
  { label: 'Privacy', symbol: { ios: 'hand.raised', android: 'shield', web: 'lock' } },
  { label: 'Help', symbol: { ios: 'questionmark.circle', android: 'help_outline', web: 'help' } },
] as const;
const PROFILE_INTERESTS = ['Education', 'Environment', 'Community', 'Health', 'Accessibility', 'Arts & Culture'] as const;
const PROFILE_GENDERS = ['Male', 'Female', 'Trans', 'Other'] as const;
const PROFILE_OCCUPATIONS = ['Student', 'Employed', 'Self-employed', 'Unemployed', 'Other'] as const;

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

function ProfileField({ label, value, onChangeText, multiline = false, maxLength, keyboardType }: { label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean; maxLength?: number; keyboardType?: 'default' | 'number-pad' }) {
  return <View style={styles.profileField}>
    <Text style={styles.profileFieldLabel}>{label}</Text>
    <TextInput
      accessibilityLabel={label}
      value={value}
      onChangeText={onChangeText}
      maxLength={maxLength}
      keyboardType={keyboardType}
      multiline={multiline}
      textAlignVertical={multiline ? 'top' : 'center'}
      autoCapitalize={multiline ? 'sentences' : 'words'}
      style={[styles.profileInput, multiline && styles.profileInputMultiline]}
      placeholderTextColor={C.muted}
    />
  </View>;
}

type ProfileContribution = { id: string; campaignId: string; campaignTitle: string; amountMinor: number; currency: string; createdAt: string };
type AccountSetting = (typeof settings)[number]['label'];

function contributionFromEvent(event: LocalActivityEvent | SignalActivityEvent): ProfileContribution | null {
  if (event.eventType !== 'contribution.simulated' || typeof event.campaignId !== 'string') return null;
  if ('metadata' in event && (event.metadata.recoveredFromSavedLedger === true || event.metadata.recoveredFromAnonymousDevice === true)) return null;
  const metadata = event.metadata;
  const amountMinor = metadata.amountMinor;
  if (typeof amountMinor !== 'number' || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) return null;
  const contributionId = typeof metadata.contributionId === 'string' ? metadata.contributionId : event.id;
  return {
    id: contributionId,
    campaignId: event.campaignId,
    campaignTitle: event.campaignTitle || 'Campaign',
    amountMinor,
    currency: typeof metadata.currency === 'string' ? metadata.currency : 'USD',
    createdAt: event.createdAt,
  };
}

export default function ProfileScreen() {
  const { user, session, signOut, updateProfile, refreshAccessToken } = useAuth();
  const scrollRef = useRef<ScrollView>(null);
  const [signOutError, setSignOutError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [localCampaigns, setLocalCampaigns] = useState<(LocalCampaignIndexEntry & { apiSubmissionStatus?: 'submitted' })[]>([]);
  const [contributions, setContributions] = useState<ProfileContribution[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);
  const [campaignRecordsAvailable, setCampaignRecordsAvailable] = useState(false);
  const [contributionRecordsAvailable, setContributionRecordsAvailable] = useState(false);
  const [activeSetting, setActiveSetting] = useState<AccountSetting | null>(null);
  const [profileName, setProfileName] = useState('');
  const [profileLocation, setProfileLocation] = useState('');
  const [profileInterests, setProfileInterests] = useState<string[]>([]);
  const [profileAboutMe, setProfileAboutMe] = useState('');
  const [profileAge, setProfileAge] = useState('');
  const [profileGender, setProfileGender] = useState('');
  const [profileOccupation, setProfileOccupation] = useState('');
  const [profileCustomOccupation, setProfileCustomOccupation] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState('');
  useWebScrollDiagnostics(scrollRef, 'profile');
  const displayName = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email?.split('@')[0] ?? 'SIGNAL member';
  const initials = displayName.split(/\s+/).map((part) => part.charAt(0)).join('').slice(0, 2).toUpperCase();
  const savedProfileLocation = user?.user_metadata?.location?.trim() ?? '';
  const savedProfileAboutMe = user?.user_metadata?.about_me?.trim() ?? '';
  const savedProfileInterests = Array.isArray(user?.user_metadata?.interests) ? user.user_metadata.interests.filter((item): item is string => typeof item === 'string') : [];
  const savedProfileAge = typeof user?.user_metadata?.age === 'number' ? user.user_metadata.age : null;
  const savedProfileGender = typeof user?.user_metadata?.gender === 'string' ? user.user_metadata.gender : '';
  const savedProfileOccupation = typeof user?.user_metadata?.occupation === 'string' ? user.user_metadata.occupation : '';

  useEffect(() => {
    let active = true;
    void (async () => {
      await Promise.resolve();
      if (!user?.id) {
        if (active) {
          setLocalCampaigns([]);
          setContributions([]);
          setCampaignRecordsAvailable(false);
          setContributionRecordsAvailable(false);
          setRecordsLoading(false);
        }
        return;
      }
      if (active) setRecordsLoading(true);
      let localCampaignsRead = false;
      let localEventsRead = false;
      let local: LocalCampaignIndexEntry[] = [];
      let localEvents: LocalActivityEvent[] = [];
      let remote: Awaited<ReturnType<typeof listSubmittedCampaignsFromApi>> = [];
      let remoteEvents: SignalActivityEvent[] = [];
      try { local = await readCampaignSubmissions(user.id); localCampaignsRead = true; } catch { /* Report unavailable only if no other source succeeds. */ }
      try { localEvents = await readOwnedLocalActivityEvents(user.id); localEventsRead = true; } catch { /* Keep the API source available. */ }
      if (session?.access_token && isSignalApiConfigured()) {
        try { remote = await listSubmittedCampaignsFromApi(session.access_token); } catch { /* Local records remain visible offline. */ }
        try { remoteEvents = await getSignalActivityWithRefresh(session.access_token, refreshAccessToken); } catch { /* Preserve saved local account events. */ }
      }
      const merged = new Map<string, LocalCampaignIndexEntry & { apiSubmissionStatus?: 'submitted' }>();
      for (const item of local) merged.set(item.id, item);
      for (const event of localEvents) {
        if (event.eventType !== 'campaign.submitted' || !event.campaignId || !event.campaignTitle || event.metadata.recoveredFromAnonymousDevice === true) continue;
        if (!merged.has(event.campaignId)) merged.set(event.campaignId, { id: event.campaignId, title: event.campaignTitle, category: 'Campaign', creatorName: displayName, submittedAt: event.createdAt });
      }
      for (const item of remote) merged.set(item.id, item);
      for (const event of remoteEvents) {
        if (event.eventType !== 'campaign.submitted' || !event.campaignId || !event.campaignTitle) continue;
        merged.set(event.campaignId, { id: event.campaignId, title: event.campaignTitle, category: 'Campaign', creatorName: displayName, submittedAt: event.createdAt, apiSubmissionStatus: 'submitted' });
      }
      const contributionMap = new Map<string, ProfileContribution>();
      for (const event of localEvents) {
        const contribution = contributionFromEvent(event);
        if (contribution) contributionMap.set(contribution.id, contribution);
      }
      for (const event of remoteEvents) {
        const contribution = contributionFromEvent(event);
        if (contribution) contributionMap.set(contribution.id, contribution);
      }
      if (active) {
        setLocalCampaigns([...merged.values()].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)));
        setContributions([...contributionMap.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
        setCampaignRecordsAvailable(localCampaignsRead || localEventsRead || Boolean(session?.access_token && isSignalApiConfigured()));
        setContributionRecordsAvailable(localEventsRead || Boolean(session?.access_token && isSignalApiConfigured()));
        setRecordsLoading(false);
      }
    })().catch(() => {
      if (active) {
        setLocalCampaigns([]);
        setContributions([]);
        setCampaignRecordsAvailable(false);
        setContributionRecordsAvailable(false);
        setRecordsLoading(false);
      }
    });
    return () => { active = false; };
  }, [displayName, refreshAccessToken, session?.access_token, user?.id]);

  const openSetting = (label: AccountSetting) => {
    if ((label === 'Edit Profile' || label === 'Notifications') && !user) {
      router.push('/login' as never);
      return;
    }
    if (label === 'Privacy' || label === 'Help') {
      router.push({ pathname: '/information', params: { section: label.toLowerCase() } } as never);
      return;
    }
    if (label === 'Edit Profile') {
      setProfileName(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '');
      setProfileLocation(user?.user_metadata?.location ?? '');
      setProfileInterests(Array.isArray(user?.user_metadata?.interests) ? user.user_metadata.interests : []);
      setProfileAboutMe(user?.user_metadata?.about_me ?? '');
      setProfileAge(typeof user?.user_metadata?.age === 'number' ? String(user.user_metadata.age) : '');
      setProfileGender(typeof user?.user_metadata?.gender === 'string' ? user.user_metadata.gender : '');
      const occupationValue = typeof user?.user_metadata?.occupation === 'string' ? user.user_metadata.occupation : '';
      if ((PROFILE_OCCUPATIONS as readonly string[]).includes(occupationValue)) {
        setProfileOccupation(occupationValue);
        setProfileCustomOccupation('');
      } else {
        setProfileOccupation(occupationValue ? 'Other' : '');
        setProfileCustomOccupation(occupationValue);
      }
      setProfileError('');
    }
    setActiveSetting(label);
  };

  const saveProfile = async () => {
    const fullName = profileName.trim();
    if (fullName.length < 2 || fullName.length > 100) {
      setProfileError('Enter a display name between 2 and 100 characters.');
      return;
    }
    if (profileLocation.trim().length > 100) {
      setProfileError('Keep your location to 100 characters or fewer.');
      return;
    }
    if (profileAboutMe.trim().length > 280) {
      setProfileError('Keep About me to 280 characters or fewer.');
      return;
    }
    if (profileAge.trim() && (!/^\d{1,3}$/.test(profileAge.trim()) || Number(profileAge) < 1 || Number(profileAge) > 120)) {
      setProfileError('Enter a whole age from 1 to 120.');
      return;
    }
    if ((profileOccupation === 'Other' ? profileCustomOccupation : profileOccupation).trim().length > 80) {
      setProfileError('Keep occupation to 80 characters or fewer.');
      return;
    }
    if (!user || !session) {
      setProfileError('Sign in again before saving profile changes.');
      return;
    }
    setProfileError('');
    setProfileSaving(true);
    try {
      await updateProfile({ full_name: fullName, location: profileLocation.trim(), interests: profileInterests, about_me: profileAboutMe.trim(), age: profileAge.trim() ? Number(profileAge.trim()) : null, gender: profileGender, occupation: profileOccupation === 'Other' ? profileCustomOccupation.trim() : profileOccupation });
      setActiveSetting(null);
      setProfileNotice('Profile updated.');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Your profile could not be saved. Try again.');
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
      >
        <Text style={styles.wordmark}>SIGNAL</Text>
        {profileNotice ? <Text accessibilityRole="alert" style={styles.profileNotice}>{profileNotice}</Text> : null}

        <View style={styles.profileCard}>
          <View style={styles.avatar} accessibilityLabel="Profile initials avatar">
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <View style={styles.status}>
            <Text style={styles.statusText}>{user ? 'Signed in' : 'Sign in to view account data'}</Text>
            </View>
            {savedProfileLocation ? <Text style={styles.profileDetail}>Location · {savedProfileLocation}</Text> : null}
            {savedProfileAge !== null ? <Text style={styles.profileDetail}>Age · {savedProfileAge}</Text> : null}
            {savedProfileGender ? <Text style={styles.profileDetail}>Gender · {savedProfileGender}</Text> : null}
            {savedProfileOccupation ? <Text style={styles.profileDetail}>Occupation · {savedProfileOccupation}</Text> : null}
            {savedProfileAboutMe ? <Text style={styles.profileAbout}>{savedProfileAboutMe}</Text> : null}
            {savedProfileInterests.length ? <View style={styles.profileInterestTags}>{savedProfileInterests.map((interest) => <Text key={interest} style={styles.profileInterestTag}>{interest}</Text>)}</View> : null}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeading>My Campaigns</SectionHeading>
          {recordsLoading ? <Text style={styles.loadingText}>Loading your saved campaigns…</Text> : localCampaigns.length ? <View style={styles.localCampaignList}>
            {localCampaigns.map((campaign) => <Pressable
              key={campaign.id}
              accessibilityRole="button"
              accessibilityLabel={`View submitted campaign ${campaign.title}`}
              onPress={() => router.push({ pathname: '/campaign/[id]', params: { id: `${campaign.apiSubmissionStatus === 'submitted' ? 'api' : 'local'}-${campaign.id}` } } as never)}
              style={({ pressed }) => [styles.localCampaignRow, pressed && styles.pressed]}
            >
              <View style={styles.localCampaignCopy}>
                <Text style={styles.localCampaignTitle}>{campaign.title || 'Untitled campaign'}</Text>
                <Text style={styles.localCampaignMeta}>{campaign.category || 'Campaign'} · {campaign.creatorName || displayName}</Text>
                <Text style={styles.localCampaignStatus}>{campaign.apiSubmissionStatus === 'submitted' ? 'SIGNAL API · shared with your account' : 'On this device · not synced to your account'}</Text>
              </View>
              <Text style={styles.localCampaignArrow}>›</Text>
            </Pressable>)}
          </View> : <EmptyState
            title={!user ? 'Sign in to view your campaigns' : campaignRecordsAvailable ? 'No campaigns created yet' : 'Campaign records unavailable'}
            description={!user ? 'Your account campaigns are private. Sign in to load records associated with your account.' : campaignRecordsAvailable ? 'Campaigns submitted from this account or saved submissions will appear here.' : 'Saved campaign records could not be loaded. Try again when your device storage or account service is available.'}
            action={
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(user ? '/create' as never : '/login' as never)}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
              >
                <Text style={styles.primaryButtonText}>Create Campaign</Text>
              </Pressable>
            }
          />}
        </View>

        <View style={styles.section}>
          <SectionHeading>My Contributions</SectionHeading>
          {recordsLoading ? <Text style={styles.loadingText}>Loading your contribution activity…</Text> : contributions.length ? <View style={styles.localCampaignList}>
            {contributions.map((contribution) => <View key={contribution.id} style={styles.contributionRow}>
              <View style={styles.contributionMark}><SymbolView name={{ ios: 'arrow.up.right', android: 'north_east', web: 'north_east' }} size={15} tintColor={C.green} /></View>
              <View style={styles.localCampaignCopy}>
                <Text style={styles.localCampaignTitle}>{contribution.campaignTitle}</Text>
                <Text style={styles.localCampaignMeta}>{formatUsdMinor(contribution.amountMinor)} simulated contribution · {new Date(contribution.createdAt).toLocaleDateString()}</Text>
              </View>
            </View>)}
          </View> : <EmptyState
            title={!user ? 'Sign in to view your contributions' : contributionRecordsAvailable ? 'No contribution activity' : 'Contribution records unavailable'}
            description={!user ? 'Only contribution activity associated with your account is shown here.' : contributionRecordsAvailable ? 'Your confirmed simulated contributions will appear here. No real payments are processed by this demo.' : 'Your account contribution records could not be loaded. Try again when your device storage or account service is available.'}
          />}
        </View>

        <View style={styles.section}>
          <View style={styles.settingsHeading}>
            <SectionHeading>Account Settings</SectionHeading>
          </View>
          <View style={styles.settingsCard}>
            {settings.map((item, index) => (
              <Pressable key={item.label} accessibilityRole="button" onPress={() => openSetting(item.label)} style={({ pressed }) => [styles.settingRow, index < settings.length - 1 && styles.settingDivider, pressed && styles.pressed]}>
                <View style={styles.settingLeft}>
                  <SymbolView name={item.symbol} size={17} tintColor={C.text} />
                  <Text style={styles.settingLabel}>{item.label}</Text>
                </View>
                <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={14} tintColor={C.green} />
              </Pressable>
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
            <SymbolView name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }} size={17} tintColor={C.green} />
            <Text style={styles.signOutTitle}>{signingOut ? 'Signing Out…' : 'Sign Out'}</Text>
          </Pressable>
        </View>

        <Text style={styles.footer}>Small signals. Wider circles.</Text>
      </ScrollView>
      <Modal visible={activeSetting !== null} transparent animationType="fade" onRequestClose={() => setActiveSetting(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.settingDialog}>
            <Text accessibilityRole="header" style={styles.settingDialogTitle}>{activeSetting}</Text>
            {activeSetting === 'Edit Profile' ? <ScrollView keyboardShouldPersistTaps="handled" style={styles.profileEditorScroll} contentContainerStyle={styles.profileEditor}>
              <Text style={styles.settingDialogCopy}>Update the profile information saved to your SIGNAL account.</Text>
              <Text style={styles.settingDialogCopy}>{user?.email}</Text>
              <ProfileField label="Display name *" value={profileName} onChangeText={(value) => { setProfileName(value); setProfileError(''); }} maxLength={100} />
              <ProfileField label="Location (optional)" value={profileLocation} onChangeText={(value) => { setProfileLocation(value); setProfileError(''); }} maxLength={100} />
              <ProfileField label="Age (optional)" value={profileAge} onChangeText={(value) => { setProfileAge(value); setProfileError(''); }} keyboardType="number-pad" maxLength={3} />
              <View style={styles.profileField}>
                <Text style={styles.profileFieldLabel}>Gender (optional)</Text>
                <View style={styles.profileInterests}>{PROFILE_GENDERS.map((option) => {
                  const selected = profileGender === option;
                  return <Pressable key={option} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setProfileGender((current) => current === option ? '' : option)} style={[styles.profileInterestChip, selected && styles.profileInterestChipSelected]}>
                    <Text style={[styles.profileInterestText, selected && styles.profileInterestTextSelected]}>{option}</Text>
                  </Pressable>;
                })}</View>
              </View>
              <View style={styles.profileField}>
                <Text style={styles.profileFieldLabel}>Occupation (optional)</Text>
                <View style={styles.profileInterests}>{PROFILE_OCCUPATIONS.map((option) => {
                  const selected = profileOccupation === option;
                  return <Pressable key={option} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => setProfileOccupation((current) => current === option ? '' : option)} style={[styles.profileInterestChip, selected && styles.profileInterestChipSelected]}>
                    <Text style={[styles.profileInterestText, selected && styles.profileInterestTextSelected]}>{option}</Text>
                  </Pressable>;
                })}</View>
                {profileOccupation === 'Other' ? <ProfileField label="Your occupation (optional)" value={profileCustomOccupation} onChangeText={(value) => { setProfileCustomOccupation(value); setProfileError(''); }} maxLength={80} /> : null}
              </View>
              <View style={styles.profileField}>
                <Text style={styles.profileFieldLabel}>Interests (optional)</Text>
                <View style={styles.profileInterests}>{PROFILE_INTERESTS.map((interest) => {
                  const selected = profileInterests.includes(interest);
                  return <Pressable key={interest} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => setProfileInterests((current) => selected ? current.filter((item) => item !== interest) : [...current, interest])} style={[styles.profileInterestChip, selected && styles.profileInterestChipSelected]}>
                    <Text style={[styles.profileInterestText, selected && styles.profileInterestTextSelected]}>{interest}</Text>
                  </Pressable>;
                })}</View>
              </View>
              <ProfileField label="About me (optional)" value={profileAboutMe} onChangeText={(value) => { setProfileAboutMe(value); setProfileError(''); }} multiline maxLength={280} />
              {profileError ? <Text accessibilityRole="alert" style={styles.profileError}>{profileError}</Text> : null}
              <Pressable accessibilityRole="button" disabled={profileSaving} onPress={() => { void saveProfile(); }} style={({ pressed }) => [styles.primaryButton, profileSaving && styles.disabled, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>{profileSaving ? 'Saving…' : 'Save Profile'}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setActiveSetting(null)} style={styles.profileCancel}><Text style={styles.profileCancelText}>Cancel</Text></Pressable>
            </ScrollView> : <>
              <Text style={styles.settingDialogCopy}>Notification preferences are not configured. No notification settings can be changed or saved here.</Text>
              <Pressable accessibilityRole="button" onPress={() => setActiveSetting(null)} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                <Text style={styles.primaryButtonText}>Close</Text>
              </Pressable>
            </>}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, minHeight: 0, backgroundColor: C.paper },
  scroll: { flex: 1, minHeight: 0 },
  content: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 128, maxWidth: 680, width: '100%', alignSelf: 'center' },
  wordmark: { color: C.text, letterSpacing: 2.4, fontSize: 11, fontWeight: '700', textAlign: 'center', marginBottom: 22 },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 9 },
  avatar: { width: 62, height: 62, borderRadius: 31, backgroundColor: C.maroonLight, borderWidth: 1, borderColor: C.maroon, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.text, fontSize: 19, fontWeight: '700', letterSpacing: 0.5 },
  profileCopy: { flex: 1, minWidth: 0 },
  name: { color: C.text, fontSize: 21, lineHeight: 27, fontWeight: '600' },
  email: { color: C.muted, fontSize: 13, marginTop: 3 },
  status: { alignSelf: 'flex-start', backgroundColor: C.maroonLight, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 5, marginTop: 10 },
  statusText: { color: C.maroon, fontSize: 10, fontWeight: '700' },
  profileDetail: { color: C.green, fontSize: 11, lineHeight: 16, marginTop: 8, fontWeight: '600' },
  profileAbout: { color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 5 },
  profileInterestTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7 },
  profileInterestTag: { overflow: 'hidden', color: C.green, backgroundColor: C.backgroundSelected, fontSize: 10, lineHeight: 14, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  section: { marginTop: 31 },
  sectionHeading: { color: C.green, fontSize: 23, lineHeight: 29, fontWeight: '600', letterSpacing: -0.35, marginBottom: 12 },
  emptyCard: { padding: 17, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 9 },
  emptyTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
  emptyDescription: { color: C.muted, fontSize: 12, lineHeight: 19, marginTop: 6 },
  localCampaignList: { gap: 9 },
  localCampaignRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 9 },
  localCampaignCopy: { flex: 1, minWidth: 0, gap: 4 },
  localCampaignTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
  localCampaignMeta: { color: C.muted, fontSize: 11, lineHeight: 16 },
  localCampaignStatus: { color: C.green, fontSize: 10, fontWeight: '700' },
  loadingText: { color: C.muted, fontSize: 12, lineHeight: 18, paddingVertical: 10 },
  contributionRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 9 },
  contributionMark: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: C.backgroundSelected },
  localCampaignArrow: { color: C.text, fontSize: 25, lineHeight: 28 },
  primaryButton: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 17, marginTop: 15, backgroundColor: C.green, borderRadius: 6 },
  primaryButtonText: { color: C.paper, fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.72 },
  settingsCard: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 9, paddingHorizontal: 15 },
  settingRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  settingsHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingDivider: { borderBottomWidth: 1, borderBottomColor: C.line },
  settingLabel: { color: C.text, fontSize: 13, fontWeight: '600' },
  signOutRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15, marginTop: 12, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 9 },
  signOutTitle: { color: C.muted, fontSize: 13, fontWeight: '600' },
  signOutError: { color: C.red, fontSize: 11, lineHeight: 16, marginTop: 8 },
  footer: { color: C.text, textAlign: 'center', fontSize: 12, letterSpacing: 0.7, marginTop: 32 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 22, backgroundColor: 'rgba(41,43,36,0.46)' },
  settingDialog: { gap: 12, padding: 21, borderRadius: 10, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, maxHeight: '92%', maxWidth: 480, width: '100%', alignSelf: 'center' },
  settingDialogTitle: { color: C.green, fontSize: 20, fontWeight: '700' },
  settingDialogCopy: { color: C.text, fontSize: 13, lineHeight: 19 },
  profileNotice: { color: C.green, fontSize: 12, lineHeight: 18, fontWeight: '700', marginBottom: 12 },
  profileEditorScroll: { flexGrow: 0, minHeight: 0, maxHeight: '70%' },
  profileEditor: { gap: 12, paddingBottom: 4 },
  profileField: { gap: 6 },
  profileFieldLabel: { color: C.text, fontSize: 12, fontWeight: '700' },
  profileInput: { minHeight: 44, borderWidth: 1, borderColor: C.line, borderRadius: 7, backgroundColor: C.surface, color: C.text, fontSize: 13, paddingHorizontal: 11, paddingVertical: 9 },
  profileInputMultiline: { minHeight: 84, textAlignVertical: 'top' },
  profileInterests: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  profileInterestChip: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 17, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface },
  profileInterestChipSelected: { backgroundColor: C.green, borderColor: C.green },
  profileInterestText: { color: C.text, fontSize: 11, fontWeight: '600' },
  profileInterestTextSelected: { color: C.paper },
  profileError: { color: C.error, fontSize: 12, lineHeight: 18 },
  profileCancel: { minHeight: 38, alignSelf: 'flex-start', justifyContent: 'center', paddingHorizontal: 5 },
  profileCancelText: { color: C.text, fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.55 },
});
