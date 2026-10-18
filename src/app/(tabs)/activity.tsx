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

type ActivityFilter = 'All' | 'Campaign Updates' | 'Contributions & funding';
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

const filters: ActivityFilter[] = ['All', 'Campaign Updates', 'Contributions & funding'];

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
    .filter((event) => selectedFilter === 'All'
      || (selectedFilter === 'Contributions & funding' ? event.kind === 'account-contribution' : event.kind !== 'account-contribution'))
    .sort((left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id)), [allEvents, selectedFilter]);

  const campaignsById = useMemo(() => new Map(discoveryCampaigns.map((campaign) => [campaign.id, campaign])), []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator>
        <Text style={styles.title}>Activity</Text>
        <Text style={styles.intro}>Follow the progress of campaigns and the messages they aim to amplify.</Text>

        <View style={styles.demoNote}>
          <Text style={styles.demoNoteText}>{session ? 'Account events are loaded from this device and the SIGNAL API when available.' : 'Saved activity on this device is labeled On this device. Sign in to load private API activity.'}</Text>
        </View>
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
          <Text style={styles.listTitle}>Recent activity</Text>
          <Text style={styles.count}>{visibleEvents.length} {visibleEvents.length === 1 ? 'update' : 'updates'}</Text>
        </View>

        {visibleEvents.length === 0 && !(apiRequestSucceeded && localAccountEvents.length === 0 && accountEvents.length === 0) ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No activity yet</Text>
            <Text style={styles.emptyDescription}>There are no items in this activity view right now.</Text>
          </View>
        ) : (
          <View style={styles.timeline}>
            {visibleEvents.map((event, index) => {
              const campaign = campaignsById.get(event.campaignId);
              const campaignTitle = campaign?.title ?? event.campaignTitle ?? event.title;
              const campaignCategory = campaign?.category;
              return (
                <Pressable
                  key={event.id}
                  accessibilityRole={event.campaignId ? 'button' : 'text'}
                  disabled={!event.campaignId}
                  accessibilityLabel={`${event.title}${campaign ? ` for ${campaignTitle}. Open campaign details.` : ''}`}
                  onPress={() => { if (event.campaignId) router.push({ pathname: '/campaign/[id]', params: event.localOwnerId
                    ? { id: `local-${event.campaignId}`, owner: event.localOwnerId }
                    : event.source === 'api' ? { id: `api-${event.campaignId}` } : { id: event.campaignId } } as never); }}
                  style={({ pressed }) => [styles.eventRow, pressed && styles.pressed]}
                >
                  <View style={styles.markerColumn}>
                    <View style={[styles.marker, event.kind === 'account-contribution' && styles.fundingMarker]}>
                      <Text style={styles.markerText}>{event.marker}</Text>
                    </View>
                    {index < visibleEvents.length - 1 && <View style={styles.timelineLine} />}
                  </View>
                  <View style={styles.eventContent}>
                    <View style={styles.eventTopline}>
                      <Text style={styles.eventTitle}>{event.title}</Text>
                      <Text style={styles.eventDate}>{formatEventDate(event.date)}</Text>
                    </View>
                    {event.campaignId ? <Text style={styles.campaignName}>{campaignTitle}{campaignCategory ? ` · ${campaignCategory}` : ''}</Text> : null}
                    <Text style={styles.eventDescription}>{event.description}</Text>
                    <Text style={styles.sourceLabel}>{event.source === 'api' ? 'SIGNAL API' : event.source === 'recovered-device' ? 'Recovered from this device' : 'On this device'}</Text>
                    {event.campaignId ? <Text style={styles.openLink}>View campaign →</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function toLocalEvent(event: LocalActivityEvent, ownerId: string): ActivityEvent {
  const recoveredAnonymous = event.metadata.recoveredFromAnonymousDevice === true;
  return {
    id: event.id,
    campaignId: event.campaignId,
    campaignTitle: event.campaignTitle,
    date: dateFromTimestamp(event.createdAt),
    kind: event.eventType === 'contribution.simulated' ? 'account-contribution' : 'account-status',
    title: event.eventType === 'campaign.submitted' ? (recoveredAnonymous ? 'Recovered campaign submission' : 'Campaign submission saved') : 'Campaign activity',
    description: recoveredAnonymous ? `${event.campaignTitle} · recovered from this device. The original account ownership could not be verified.` : `${event.campaignTitle} · saved on this device.`,
    marker: event.eventType === 'contribution.simulated' ? '$' : '＋',
    source: recoveredAnonymous ? 'recovered-device' : 'on-device',
    localOwnerId: recoveredAnonymous ? 'device-draft' : ownerId,
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
  title: { color: C.text, fontSize: 31, lineHeight: 38, fontWeight: '600', letterSpacing: -0.6 },
  intro: { color: C.muted, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 17 },
  demoNote: { backgroundColor: C.surfaceSoft, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 7 },
  demoNoteText: { color: C.muted, fontSize: 10, lineHeight: 15 },
  syncStatus: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 9, marginTop: 10, borderRadius: 7, backgroundColor: C.surfaceSoft },
  syncStatusText: { flex: 1, color: C.muted, fontSize: 10, lineHeight: 15 },
  errorState: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, padding: 12, marginTop: 10, borderRadius: 7, backgroundColor: '#F6E7E2' },
  errorText: { flex: 1, color: C.text, fontSize: 11, lineHeight: 16 },
  retryText: { color: C.text, fontWeight: '700', fontSize: 11 },
  loadingText: { color: C.muted, fontSize: 11, marginTop: 12 },
  sourceLabel: { color: C.muted, fontSize: 9, fontWeight: '700', marginTop: 6, textTransform: 'uppercase' },
  filterList: { gap: 8, paddingVertical: 17 },
  filterChip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 13, borderWidth: 1, borderColor: C.line, borderRadius: 18, backgroundColor: C.surface },
  filterChipSelected: { backgroundColor: C.brown, borderColor: C.brown },
  filterText: { color: C.muted, fontSize: 11, fontWeight: '600' },
  filterTextSelected: { color: C.espresso },
  listHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 3 },
  listTitle: { color: C.text, fontSize: 19, fontWeight: '600' },
  count: { color: C.muted, fontSize: 10 },
  timeline: { marginTop: 12 },
  eventRow: { flexDirection: 'row', gap: 12, minHeight: 118 },
  pressed: { opacity: 0.74 },
  markerColumn: { width: 30, alignItems: 'center' },
  marker: { zIndex: 1, width: 29, height: 29, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: C.brownLight, borderWidth: 1, borderColor: C.line },
  fundingMarker: { backgroundColor: '#76836C', borderColor: C.green },
  statusMarker: { backgroundColor: C.surfaceSoft, borderColor: C.line },
  markerText: { color: C.text, fontSize: 14, lineHeight: 18, fontWeight: '700' },
  timelineLine: { position: 'absolute', top: 29, bottom: 0, width: 1, backgroundColor: C.line },
  eventContent: { flex: 1, minWidth: 0, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: C.line },
  eventTopline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  eventTitle: { flex: 1, color: C.text, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  eventDate: { color: C.muted, fontSize: 9, lineHeight: 16, flexShrink: 0 },
  campaignName: { color: C.text, fontSize: 10, fontWeight: '600', marginTop: 4 },
  eventDescription: { color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 7 },
  openLink: { color: C.text, fontSize: 10, fontWeight: '700', marginTop: 8 },
  emptyState: { padding: 22, marginTop: 12, borderWidth: 1, borderColor: C.line, borderRadius: 9, backgroundColor: C.surface },
  emptyTitle: { color: C.text, fontSize: 15, fontWeight: '700' },
  emptyDescription: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
});
