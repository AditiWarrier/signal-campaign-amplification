import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette as C } from '@/constants/theme';
import { discoveryCampaigns, type IsoDate } from '@/data/campaigns';
import { useWebScrollDiagnostics } from '@/hooks/use-web-scroll-diagnostics';
import { formatUsdMinor } from '@/data/funding';
import { getSignalActivityWithRefresh, isSignalApiConfigured, syncCampaignSubmissionToApi, type SignalActivityEvent } from '@/data/signal-api';
import { mergeAccountEvents, readLocalActivityEvents, type LocalActivityEvent } from '@/data/local-activity';
import { readCampaignDraft, readCampaignSubmission, readCampaignSubmissions, writeCampaignDraft, writeCampaignSubmission } from '@/data/campaign-draft-storage';
import { useAuth } from '@/auth/auth-context';

type ActivityFilter = 'All' | 'Campaign Updates' | 'Contributions' | 'Funding Milestones' | 'Following' | 'Account';
type ActivityKind = 'account-status' | 'account-contribution';

type ActivityEvent = {
  id: string;
  campaignId: string;
  date: IsoDate;
  kind: ActivityKind;
  title: string;
  campaignTitle?: string;
  description: string;
  marker: string;
  source: 'on-device' | 'recovered-device' | 'api';
  localOwnerId?: string;
  eventType?: string;
  actionId?: string;
};

const filters: ActivityFilter[] = ['All', 'Campaign Updates', 'Contributions', 'Funding Milestones', 'Following', 'Account'];

type DemoNotification = {
  id: string;
  category: Exclude<ActivityFilter, 'All'>;
  campaignId?: string;
  icon: string;
  title: string;
  description: string;
  time: string;
  day: 'Today' | 'Yesterday' | 'Earlier';
  unread?: boolean;
  progress?: 'funding';
};

// Illustrative preview content only. These events are never sent to or merged into the API.
const demoNotifications: DemoNotification[] = [
  { id: 'demo-deadline', category: 'Campaign Updates', campaignId: 'pages-for-all-library', icon: '◷', title: 'A deadline reminder', description: 'Every Child Deserves a Library is working toward its Dec 19 funding deadline. There is still time to help it reach more readers.', time: '2h ago', day: 'Today', unread: true },
  { id: 'demo-milestone', category: 'Funding Milestones', campaignId: 'green-bengaluru-lakes', icon: '✦', title: 'A funding milestone reached', description: "Our Lakes Aren't Dumping Grounds has crossed 35% of its goal.", time: '5h ago', day: 'Today', unread: true, progress: 'funding' },
  { id: 'demo-comment', category: 'Following', campaignId: 'neighbourhood-arts-collective', icon: '“', title: 'A new comment on a campaign you follow', description: '“I would love to see a mural that reflects the stories of our older neighbours too.”', time: 'Yesterday', day: 'Yesterday', unread: true },
  { id: 'demo-contribution', category: 'Contributions', campaignId: 'pages-for-all-library', icon: '₹', title: 'Contribution recorded', description: 'Your demo contribution was recorded for Every Child Deserves a Library. No payment was processed.', time: 'Yesterday', day: 'Yesterday' },
  { id: 'demo-promotion', category: 'Campaign Updates', campaignId: 'community-health-connect', icon: '↗', title: 'Promotion has started', description: 'Health Information Should Reach Everyone is now being prepared for distribution across Instagram and Facebook.', time: 'Yesterday', day: 'Yesterday' },
  { id: 'demo-distribution', category: 'Campaign Updates', campaignId: 'better-streets-collective', icon: '◎', title: 'Distribution is underway', description: 'The Streets We Deserve has moved into its community distribution phase. No performance metrics are available in this preview.', time: '2 days ago', day: 'Earlier' },
  { id: 'demo-approved', category: 'Campaign Updates', campaignId: 'community-health-connect', icon: '✓', title: 'Campaign approved', description: 'Health Information Should Reach Everyone is ready for backing.', time: '3 days ago', day: 'Earlier' },
  { id: 'demo-ready', category: 'Following', campaignId: 'community-health-connect', icon: '＋', title: 'A campaign is ready for backing', description: 'Health Information Should Reach Everyone is now open to contributions in the SIGNAL preview.', time: '3 days ago', day: 'Earlier' },
  { id: 'demo-submitted', category: 'Account', campaignId: 'neighbourhood-makers-market', icon: '↑', title: 'Campaign submission received', description: 'A Market for Neighbourhood Makers is in review. We will let you know when there is an update.', time: '4 days ago', day: 'Earlier' },
  { id: 'demo-returned', category: 'Account', campaignId: 'stories-across-generations', icon: '✎', title: 'A campaign needs a little more detail', description: 'Stories That Bring Generations Together was returned for edits. Review the notes on your campaign.', time: '5 days ago', day: 'Earlier' },
  { id: 'demo-completed', category: 'Campaign Updates', campaignId: 'ananya-lake-shared-responsibility', icon: '✦', title: 'Campaign completed', description: 'Our Lakes, Our Shared Responsibility reached its funding goal and wrapped up its campaign.', time: '1 week ago', day: 'Earlier' },
  { id: 'demo-report', category: 'Following', campaignId: 'ananya-lake-shared-responsibility', icon: '▤', title: 'The final report is ready', description: 'See a summary of the completed campaign and the work shared with its community.', time: '1 week ago', day: 'Earlier' },
  { id: 'demo-security', category: 'Account', icon: '⌑', title: 'A new sign-in to your account', description: 'A sign-in was detected on this device. If this was not you, review your account security.', time: '2 weeks ago', day: 'Earlier' },
  { id: 'demo-unsuccessful', category: 'Contributions', campaignId: 'neighbourhood-arts-collective', icon: '↻', title: 'Contribution could not be completed', description: 'The demo contribution did not go through. You can try again from the campaign page; no payment was taken.', time: '2 weeks ago', day: 'Earlier' },
];

type RequestFailure = Error & { status?: unknown; code?: unknown; retryAfterMs?: unknown };

function isRequestFailure(error: unknown, name: 'SignalApiError' | 'AuthRequestError'): error is RequestFailure {
  return error instanceof Error && error.name === name;
}

function activityErrorMessage(error: unknown): string {
  if (isRequestFailure(error, 'AuthRequestError') && typeof error.status === 'number' && error.status > 0) {
    return `Supabase Auth returned HTTP ${error.status}${typeof error.code === 'string' ? ` ${error.code}` : ''}: ${error.message}`;
  }
  return error instanceof Error ? error.message : 'SIGNAL API Activity request failed for an unknown reason.';
}

function retryDelayFrom(error: unknown): number | null {
  const recognized = isRequestFailure(error, 'SignalApiError') || isRequestFailure(error, 'AuthRequestError');
  if (!recognized || error.status !== 429) return null;
  return typeof error.retryAfterMs === 'number' && Number.isFinite(error.retryAfterMs) && error.retryAfterMs >= 0
    ? error.retryAfterMs
    : null;
}

function isRateLimitError(error: unknown): boolean {
  return (isRequestFailure(error, 'SignalApiError') || isRequestFailure(error, 'AuthRequestError')) && error.status === 429;
}

function formatEventDate(date: IsoDate): string {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00.000Z`));
}

export default function ActivityScreen() {
  const { session, isLoading: authLoading, refreshAccessToken } = useAuth();
  const authRef = useRef({ session, authLoading, refreshAccessToken });
  authRef.current = { session, authLoading, refreshAccessToken };
  const scrollRef = useRef<ScrollView>(null);
  useWebScrollDiagnostics(scrollRef, 'activity');
  const [selectedFilter, setSelectedFilter] = useState<ActivityFilter>('All');
  const [localAccountEvents, setLocalAccountEvents] = useState<ActivityEvent[]>([]);
  const [accountEvents, setAccountEvents] = useState<ActivityEvent[]>([]);
  const [localLoading, setLocalLoading] = useState(true);
  const [localError, setLocalError] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState('');
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [apiRequestSucceeded, setApiRequestSucceeded] = useState(false);
  const [retryAfterUntil, setRetryAfterUntil] = useState(0);
  const [retryClock, setRetryClock] = useState(Date.now());
  const retryInFlight = useRef(false);
  const retryAfterSeconds = Math.max(0, Math.ceil((retryAfterUntil - retryClock) / 1000));

  useEffect(() => {
    if (!retryAfterUntil) return;
    const timer = setInterval(() => setRetryClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [retryAfterUntil]);

  useFocusEffect(useCallback(() => {
    let active = true;
    const currentAuth = authRef.current;
    const currentSession = currentAuth.session;
    if (currentAuth.authLoading) return () => { active = false; };
    const ownerId = currentSession?.user.id ?? 'device-draft';
    setLocalAccountEvents([]);
    setLocalLoading(true);
    setLocalError('');
    const refreshLocalActivity = () => {
      void readLocalActivityEvents(ownerId).then((items) => {
        if (active) {
          setLocalAccountEvents(items.map((item) => toLocalEvent(item, ownerId)));
          setLocalLoading(false);
          setLocalError('');
        }
      }).catch(() => {
        if (active) {
          setLocalAccountEvents([]);
          setLocalLoading(false);
          setLocalError('Saved activity could not be read from this device.');
        }
      });
      if (currentSession?.user.id) {
        void readCampaignSubmissions(ownerId).then(async (entries) => {
          const campaigns = await Promise.all(entries.map((entry) => readCampaignSubmission(ownerId, entry.id)));
          if (active) setPendingSyncCount(campaigns.filter((campaign) => campaign && campaign.apiSubmissionStatus !== 'submitted').length);
        }).catch(() => { if (active) setPendingSyncCount(0); });
      } else {
        setPendingSyncCount(0);
      }
    };
    refreshLocalActivity();
    const onLocalActivityChanged = () => refreshLocalActivity();
    const onBrowserStorageChanged = (event: StorageEvent) => {
      if (event.key?.startsWith('signal.campaign.draft.v1.') && (event.key.endsWith('.activity-events.v1') || event.key.includes('.submitted'))) refreshLocalActivity();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('signal:activity-updated', onLocalActivityChanged);
      window.addEventListener('storage', onBrowserStorageChanged);
    }
    if (currentSession?.access_token && isSignalApiConfigured()) {
      setLoading(true);
      setApiStatus('');
      setAccountEvents([]);
      setApiRequestSucceeded(false);
      void getSignalActivityWithRefresh(currentSession.access_token, (rejectedToken) => authRef.current.refreshAccessToken(rejectedToken)).then((items) => {
        if (active) {
          setAccountEvents(items.map(toAccountEvent));
          setApiRequestSucceeded(true);
          setRetryAfterUntil(0);
        }
      }).catch((error: unknown) => {
        if (__DEV__) console.warn('[Activity] SIGNAL API request failed:', error);
        if (active) {
          setAccountEvents([]);
          setApiStatus(activityErrorMessage(error));
          setApiRequestSucceeded(false);
          const delay = retryDelayFrom(error);
          if (delay !== null || isRateLimitError(error)) {
            setRetryClock(Date.now());
            setRetryAfterUntil(Date.now() + (delay ?? 30_000));
          }
        }
      }).finally(() => { if (active) setLoading(false); });
    } else {
      setAccountEvents([]);
      setLoading(false);
      setApiRequestSucceeded(false);
      setApiStatus(currentSession ? 'SIGNAL API URL is not configured. Saved device activity remains available.' : 'Sign in to load private API activity.');
    }
    return () => {
      active = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('signal:activity-updated', onLocalActivityChanged);
        window.removeEventListener('storage', onBrowserStorageChanged);
      }
    };
  }, [authLoading, session?.user.id]));

  async function retryApiAndPendingSubmissions() {
    if (retryInFlight.current || retryAfterSeconds > 0 || loading) return;
    const currentSession = authRef.current.session;
    if (!currentSession?.access_token) {
      setApiStatus('Sign in to load private API activity.');
      return;
    }
    if (!isSignalApiConfigured()) {
      setApiStatus('SIGNAL API URL is not configured. Saved device activity remains available.');
      return;
    }
    retryInFlight.current = true;
    setLoading(true);
    setApiRequestSucceeded(false);
    setApiStatus('Checking the SIGNAL API…');
    let syncFailure: string | null = null;
    let remainingSyncCount = pendingSyncCount;
    try {
      const ownerId = currentSession.user.id;
      const submissions = await readCampaignSubmissions(ownerId);
      for (const entry of submissions) {
        const campaign = await readCampaignSubmission(ownerId, entry.id);
        if (!campaign || campaign.apiSubmissionStatus === 'submitted') continue;
        try {
          await syncCampaignSubmissionToApi(campaign, currentSession.access_token);
          const synced = { ...campaign, apiSubmissionStatus: 'submitted' as const };
          await writeCampaignSubmission(ownerId, synced);
          const activeRaw = await readCampaignDraft(ownerId);
          if (activeRaw) {
            try { if (JSON.parse(activeRaw)?.id === synced.id) await writeCampaignDraft(ownerId, JSON.stringify(synced)); } catch { /* The archived status remains authoritative. */ }
          }
          remainingSyncCount = Math.max(0, remainingSyncCount - 1);
        } catch (error) {
          syncFailure = error instanceof Error ? error.message : 'A saved submission could not be synced.';
          if (__DEV__) console.warn('[Activity] Campaign submission sync failed:', error);
          if (isRateLimitError(error)) throw error;
        }
      }
      const items = await getSignalActivityWithRefresh(currentSession.access_token, (rejectedToken) => authRef.current.refreshAccessToken(rejectedToken));
      setAccountEvents(items.map(toAccountEvent));
      setApiRequestSucceeded(true);
      setRetryAfterUntil(0);
      setPendingSyncCount(remainingSyncCount);
      setApiStatus(syncFailure
        ? `Activity loaded from SIGNAL API. Submission sync needs attention: ${syncFailure}`
        : items.length ? 'Activity synced with SIGNAL API.' : 'SIGNAL API connected. No account events yet.');
    } catch (error) {
      if (__DEV__) console.warn('[Activity] Retry request failed:', error);
      setAccountEvents([]);
      setApiStatus(activityErrorMessage(error));
      setApiRequestSucceeded(false);
      const delay = retryDelayFrom(error);
      if (delay !== null || isRateLimitError(error)) {
        setRetryClock(Date.now());
        setRetryAfterUntil(Date.now() + (delay ?? 30_000));
      }
    } finally {
      retryInFlight.current = false;
      setLoading(false);
    }
  }

  const allEvents = useMemo(() => mergeAccountEvents(localAccountEvents, accountEvents), [accountEvents, localAccountEvents]);

  const visibleEvents = useMemo(() => allEvents
    .filter((event) => selectedFilter === 'All' || selectedFilter === 'Account')
    .sort((left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id)), [allEvents, selectedFilter]);
  const visibleDemo = useMemo(() => demoNotifications.filter((item) => selectedFilter === 'All' || item.category === selectedFilter), [selectedFilter]);

  const campaignsById = useMemo(() => new Map(discoveryCampaigns.map((campaign) => [campaign.id, campaign])), []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator>
        <View style={styles.headingRow}>
          <View style={styles.headingCopy}>
            <Text style={styles.title}>Activity</Text>
            <Text style={styles.intro}>A closer look at the campaigns and signals you follow.</Text>
          </View>
          <View style={styles.unreadBadge}><View style={styles.unreadDot} /><Text style={styles.unreadText}>{demoNotifications.filter((item) => item.unread).length} new</Text></View>
        </View>
        <View style={styles.demoNote}><View style={styles.demoPip} /><Text style={styles.demoNoteText}>Sample activity · Illustrative events for preview only</Text></View>
        {apiStatus || pendingSyncCount > 0 ? <View style={styles.syncStatus}><Text style={styles.syncStatusText}>{apiStatus || `${pendingSyncCount} saved ${pendingSyncCount === 1 ? 'campaign is' : 'campaigns are'} waiting to sync.`}</Text>{session && isSignalApiConfigured() && <Pressable disabled={loading || retryAfterSeconds > 0} onPress={() => void retryApiAndPendingSubmissions()} accessibilityRole="button" accessibilityState={{ disabled: loading || retryAfterSeconds > 0 }}><Text style={styles.retryText}>{retryAfterSeconds > 0 ? `Retry in ${retryAfterSeconds}s` : loading ? 'Syncing…' : 'Retry sync'}</Text></Pressable>}</View> : null}
        {loading ? <Text style={styles.loadingText}>Loading account activity…</Text> : null}
        {localLoading ? <Text style={styles.loadingText}>Loading saved on-device activity…</Text> : null}
        {localError ? <View style={styles.errorState}><Text style={styles.errorText}>{localError}</Text></View> : null}
        {!localLoading && !loading && !localError && apiRequestSucceeded && localAccountEvents.length === 0 && accountEvents.length === 0
          ? <View style={styles.emptyState}><Text style={styles.emptyTitle}>No account activity yet</Text><Text style={styles.emptyDescription}>Submit a campaign to add activity to this account.</Text></View>
          : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterList}>
          {filters.map((filter) => {
            const selected = selectedFilter === filter;
            return (
              <Pressable
                key={filter}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setSelectedFilter(filter)}
                style={[styles.filterChip, selected && styles.filterChipSelected]}
              >
                <Text style={[styles.filterText, selected && styles.filterTextSelected]}>{filter}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>{selectedFilter === 'All' ? 'Recent activity' : selectedFilter}</Text>
          <Text style={styles.count}>{visibleDemo.length + visibleEvents.length} updates</Text>
        </View>
        {visibleDemo.length === 0 && visibleEvents.length === 0 ? <View style={styles.emptyState}><Text style={styles.emptyIcon}>✦</Text><Text style={styles.emptyTitle}>Nothing here just yet</Text><Text style={styles.emptyDescription}>When there is an update in {selectedFilter.toLowerCase()}, it will find a home here.</Text><Pressable onPress={() => router.push('/explore' as never)} accessibilityRole="button" style={styles.emptyAction}><Text style={styles.emptyActionText}>Explore campaigns  →</Text></Pressable></View> : null}
        {(['Today', 'Yesterday', 'Earlier'] as const).map((day) => {
          const items = visibleDemo.filter((item) => item.day === day);
          const accountItems = day === 'Earlier' ? visibleEvents : [];
          if (!items.length && !accountItems.length) return null;
          return <View key={day} style={styles.dayGroup}>
            <Text style={styles.dayLabel}>{day}</Text>
            {items.map((item) => {
              const campaign = item.campaignId ? campaignsById.get(item.campaignId) : undefined;
              return <Pressable key={item.id} accessibilityRole={campaign ? 'button' : 'text'} disabled={!campaign} accessibilityLabel={`${item.title}${campaign ? `. Open ${campaign.title}` : ''}`} onPress={() => { if (campaign) router.push({ pathname: '/campaign/[id]', params: { id: item.campaignId! } } as never); }} style={({ pressed }) => [styles.notification, item.unread && styles.notificationUnread, pressed && styles.pressed]}>
                <View style={[styles.iconBox, item.category === 'Contributions' && styles.iconWarm, item.category === 'Account' && styles.iconQuiet]}><Text style={styles.iconText}>{item.icon}</Text></View>
                <View style={styles.notificationCopy}>
                  <View style={styles.notificationTop}><Text style={styles.notificationTitle}>{item.title}</Text>{item.unread ? <View style={styles.itemUnreadDot} /> : null}</View>
                  <Text style={styles.notificationDescription}>{item.description}</Text>
                  {campaign ? <Text style={styles.campaignLabel}>{campaign.title}</Text> : null}
                  {item.progress && campaign ? <View style={styles.progressBlock}><View style={styles.progressMeta}><Text style={styles.progressCaption}>FUNDING PROGRESS</Text><Text style={styles.progressAmount}>₹{campaign.raised.toLocaleString('en-IN')} of ₹{campaign.goal.toLocaleString('en-IN')}</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.min(100, Math.round(campaign.raised / campaign.goal * 100))}%` }]} /></View></View> : null}
                  <Text style={styles.timeLabel}>{item.time}</Text>
                </View>
              </Pressable>;
            })}
            {accountItems.map((event) => {
              const campaign = campaignsById.get(event.campaignId);
              return <Pressable key={event.id} accessibilityRole={campaign ? 'button' : 'text'} disabled={!campaign} onPress={() => { if (event.campaignId) router.push({ pathname: '/campaign/[id]', params: { id: event.localOwnerId ? `local-${event.campaignId}` : event.source === 'api' ? `api-${event.campaignId}` : event.campaignId, ...(event.localOwnerId ? { owner: event.localOwnerId } : {}) } } as never); }} style={({ pressed }) => [styles.notification, pressed && styles.pressed]}>
                <View style={styles.iconBox}><Text style={styles.iconText}>{event.marker}</Text></View><View style={styles.notificationCopy}><View style={styles.notificationTop}><Text style={styles.notificationTitle}>{event.title}</Text><Text style={styles.timeLabel}>{formatEventDate(event.date)}</Text></View><Text style={styles.notificationDescription}>{event.description}</Text><Text style={styles.sourceLabel}>{event.source === 'api' ? 'SIGNAL API' : event.source === 'recovered-device' ? 'Recovered from this device' : 'On this device'}</Text></View>
              </Pressable>;
            })}
          </View>;
        })}
        <Pressable accessibilityRole="button" accessibilityLabel="Open account settings" onPress={() => router.push('/profile' as never)} style={({ pressed }) => [styles.preferences, pressed && styles.pressed]}><Text style={styles.preferencesIcon}>⚙</Text><View style={styles.preferencesCopy}><Text style={styles.preferencesTitle}>Account settings</Text><Text style={styles.preferencesDescription}>Manage your SIGNAL account</Text></View><Text style={styles.preferencesArrow}>›</Text></Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function toLocalEvent(event: LocalActivityEvent, ownerId: string): ActivityEvent {
  const recoveredAnonymous = event.metadata.recoveredFromAnonymousDevice === true;
  const isContribution = event.eventType === 'contribution.simulated';
  const amount = typeof event.metadata?.amountMinor === 'number' ? formatUsdMinor(event.metadata.amountMinor) : '';
  const title = event.campaignTitle || 'Campaign';

  return {
    id: event.id,
    campaignId: event.campaignId,
    campaignTitle: event.campaignTitle,
    date: dateFromTimestamp(event.createdAt),
    kind: isContribution ? 'account-contribution' : 'account-status',
    title: isContribution
      ? 'Simulated demo contribution'
      : event.eventType === 'campaign.submitted'
        ? (recoveredAnonymous ? 'Recovered campaign submission' : 'Campaign submission saved')
        : 'Campaign activity',
    description: isContribution
      ? `A simulated contribution${amount ? ` of ${amount}` : ''} was recorded for “${title}”. No payment was processed.`
      : recoveredAnonymous
        ? `${event.campaignTitle} · recovered from this device. The original account ownership could not be verified.`
        : `${event.campaignTitle} · saved on this device.`,
    marker: isContribution ? '$' : '＋',
    source: recoveredAnonymous ? 'recovered-device' : 'on-device',
    localOwnerId: isContribution ? undefined : (recoveredAnonymous ? 'device-draft' : ownerId),
    eventType: event.eventType,
    actionId: typeof event.metadata.contributionId === 'string' ? event.metadata.contributionId : undefined,
  };
}

function toAccountEvent(event: SignalActivityEvent): ActivityEvent {
  const date = dateFromTimestamp(event.createdAt);
  const names: Record<string, string> = {
    'campaign.draft_created': 'Campaign draft created',
    'campaign.submitted': 'Campaign submission received',
    'campaign.under_review': 'Campaign moved to review',
    'campaign.approved': 'Campaign approved',
    'campaign.rejected': 'Campaign returned for edits',
    'contribution.simulated': 'Simulated demo contribution',
  };
  const contribution = event.eventType === 'contribution.simulated';
  const amount = typeof event.metadata.amountMinor === 'number' ? formatUsdMinor(event.metadata.amountMinor) : '';
  const title = event.campaignTitle ?? 'Campaign';
  return {
    id: event.id,
    campaignId: event.campaignId ?? '',
    date,
    kind: contribution ? 'account-contribution' : 'account-status',
    title: names[event.eventType] ?? 'Campaign activity',
    description: contribution ? `A simulated contribution${amount ? ` of ${amount}` : ''} was recorded for “${title}”. No payment was processed.` : `${title} · ${event.eventType.replaceAll('.', ' ')}.`,
    marker: contribution ? '$' : '↗',
    source: 'api',
    eventType: event.eventType,
    actionId: typeof event.metadata.contributionId === 'string' ? event.metadata.contributionId : undefined,
  };
}

function dateFromTimestamp(value: string): IsoDate {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? new Date(0).toISOString().slice(0, 10) as IsoDate : timestamp.toISOString().slice(0, 10) as IsoDate;
}

const styles = StyleSheet.create({
  safe: { flex: 1, minHeight: 0, backgroundColor: C.paper },
  scroll: { flex: 1, minHeight: 0 },
  content: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 128, maxWidth: 680, width: '100%', alignSelf: 'center' },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  headingCopy: { flex: 1, minWidth: 0 },
  title: { color: C.text, fontSize: 31, lineHeight: 38, fontWeight: '600', letterSpacing: -0.6 },
  intro: { color: C.muted, fontSize: 14, lineHeight: 21, marginTop: 6 },
  unreadBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 15, backgroundColor: C.backgroundSelected },
  unreadDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.green },
  unreadText: { color: C.green, fontSize: 10, fontWeight: '700' },
  demoNote: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 17, marginBottom: 2 },
  demoPip: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.brown },
  demoNoteText: { color: C.muted, fontSize: 10, lineHeight: 15, letterSpacing: 0.2 },
  syncStatus: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 9, marginTop: 10, borderRadius: 7, backgroundColor: C.surfaceSoft },
  syncStatusText: { flex: 1, color: C.muted, fontSize: 10, lineHeight: 15 },
  errorState: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, padding: 12, marginTop: 10, borderRadius: 7, backgroundColor: C.maroonLight },
  errorText: { flex: 1, color: C.text, fontSize: 11, lineHeight: 16 },
  retryText: { color: C.text, fontWeight: '700', fontSize: 11 },
  loadingText: { color: C.muted, fontSize: 11, marginTop: 12 },
  sourceLabel: { color: C.muted, fontSize: 9, fontWeight: '700', marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.6 },
  filterList: { gap: 8, paddingTop: 17, paddingBottom: 20, paddingRight: 22 },
  filterChip: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: C.line, borderRadius: 19, backgroundColor: 'transparent' },
  filterChipSelected: { backgroundColor: C.brown, borderColor: C.brown },
  filterText: { color: C.muted, fontSize: 11, fontWeight: '600' },
  filterTextSelected: { color: C.paper, fontWeight: '700' },
  listHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 1 },
  listTitle: { color: C.text, fontSize: 20, lineHeight: 26, fontWeight: '600', letterSpacing: -0.3 },
  count: { color: C.muted, fontSize: 10 },
  dayGroup: { marginTop: 20 },
  dayLabel: { color: C.green, fontSize: 10, fontWeight: '700', letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 8 },
  notification: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 12, paddingVertical: 14, borderRadius: 12 },
  notificationUnread: { backgroundColor: '#F0EDE4' },
  pressed: { opacity: 0.72 },
  iconBox: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: C.backgroundSelected },
  iconWarm: { backgroundColor: '#EAE2D4' },
  iconQuiet: { backgroundColor: C.surface },
  iconText: { color: C.green, fontSize: 18, lineHeight: 22, fontWeight: '600' },
  notificationCopy: { flex: 1, minWidth: 0 },
  notificationTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  notificationTitle: { flex: 1, color: C.text, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  itemUnreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.green, marginTop: 5 },
  notificationDescription: { color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 4 },
  campaignLabel: { color: C.text, fontSize: 10, lineHeight: 15, fontWeight: '600', marginTop: 6 },
  timeLabel: { color: C.muted, fontSize: 9, lineHeight: 14, marginTop: 7 },
  progressBlock: { marginTop: 10, padding: 10, borderRadius: 8, backgroundColor: C.paper },
  progressMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: 6, marginBottom: 7 },
  progressCaption: { color: C.muted, fontSize: 8, fontWeight: '700', letterSpacing: 0.8 },
  progressAmount: { color: C.text, fontSize: 9, fontWeight: '700' },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: C.surface, overflow: 'hidden' },
  progressFill: { height: 5, borderRadius: 3, backgroundColor: C.green },
  emptyState: { alignItems: 'center', padding: 24, marginTop: 16, borderRadius: 12, backgroundColor: C.surface },
  emptyIcon: { color: C.green, fontSize: 25, marginBottom: 8 },
  emptyTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
  emptyDescription: { color: C.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 5 },
  emptyAction: { marginTop: 13, paddingVertical: 8, paddingHorizontal: 12 },
  emptyActionText: { color: C.green, fontSize: 11, fontWeight: '700' },
  preferences: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, marginTop: 27, marginBottom: 10, backgroundColor: C.surface, borderRadius: 10 },
  preferencesIcon: { color: C.green, fontSize: 18 },
  preferencesCopy: { flex: 1 },
  preferencesTitle: { color: C.text, fontSize: 11, fontWeight: '700' },
  preferencesDescription: { color: C.muted, fontSize: 10, marginTop: 3 },
  preferencesArrow: { color: C.muted, fontSize: 22 },
});
