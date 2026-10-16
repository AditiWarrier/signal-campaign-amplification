import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { discoveryCampaigns, formatIsoDate, getDeadlineLabel, isDeadlineExpired, type IsoDate } from '@/data/campaigns';
import { useUtcToday } from '@/hooks/use-utc-today';
import { useWebScrollDiagnostics } from '@/hooks/use-web-scroll-diagnostics';

const C = {
  paper: '#EEE8DF', white: '#FFFEFA', ink: '#302A25', muted: '#776E65',
  line: '#E8E1D7', brown: '#74563F', brownLight: '#EDE5DA', green: '#536D58',
};

type ActivityFilter = 'All' | 'Campaign Updates' | 'Funding Milestones';
type ActivityKind = 'created' | 'milestone' | 'deadline' | 'ended' | 'simulated-status';

type ActivityEvent = {
  id: string;
  campaignId: string;
  date: IsoDate;
  kind: ActivityKind;
  title: string;
  description: string;
  marker: string;
};

const filters: ActivityFilter[] = ['All', 'Campaign Updates', 'Funding Milestones'];

// Fictional sample activity tied to campaign dates and existing demo campaign IDs.
const events: ActivityEvent[] = [
  { id: 'creekside-created', campaignId: 'creekside-native-plants', date: '2026-10-02', kind: 'created', title: 'Campaign submitted', description: 'A new fictional neighborhood creek restoration campaign was added to the demo feed.', marker: '＋' },
  { id: 'books-created', campaignId: 'open-books-after-school', date: '2026-09-29', kind: 'created', title: 'Campaign submitted', description: 'A fictional reading circle campaign was added to the demo feed.', marker: '＋' },
  { id: 'rights-created', campaignId: 'know-your-rights-workshop', date: '2026-09-15', kind: 'created', title: 'Campaign submitted', description: 'A fictional community rights workshop campaign was added to the demo feed.', marker: '＋' },
  { id: 'books-milestone', campaignId: 'open-books-after-school', date: '2026-10-05', kind: 'milestone', title: 'Sample funding milestone', description: 'This fictional campaign passed its first $1,000 demo-funding milestone. This is sample activity, not a recorded payment.', marker: '$' },
  { id: 'stories-created', campaignId: 'stories-from-main-street', date: '2026-10-08', kind: 'created', title: 'Campaign submitted', description: 'A fictional arts collective campaign was added to the demo feed.', marker: '＋' },
  { id: 'rights-ended', campaignId: 'know-your-rights-workshop', date: '2026-10-10', kind: 'ended', title: 'Funding period ended', description: 'The sample funding window has closed. Its activity figures are fictional demo data.', marker: '✓' },
  { id: 'neighbors-created', campaignId: 'neighbors-share-fresh-food', date: '2026-10-12', kind: 'created', title: 'Campaign submitted', description: 'A fictional neighborhood food-access campaign was added to the demo feed.', marker: '＋' },
  { id: 'creekside-status', campaignId: 'creekside-native-plants', date: '2026-10-14', kind: 'simulated-status', title: 'Simulated amplification status update', description: 'This campaign is marked ready for amplification in the demo. No live ads or distribution are running through SIGNAL.', marker: '↗' },
  { id: 'creekside-halfway', campaignId: 'creekside-native-plants', date: '2026-10-15', kind: 'milestone', title: 'Sample funding passed halfway', description: 'The fictional demo total is over half of its sample goal. This is not a real transaction or payment record.', marker: '◎' },
  { id: 'books-deadline', campaignId: 'open-books-after-school', date: '2026-10-16', kind: 'deadline', title: 'Funding deadline approaching', description: 'The fictional campaign deadline is coming up. Check the campaign page for its current demo deadline.', marker: '◷' },
];

function formatEventDate(date: IsoDate): string {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${date}T00:00:00.000Z`));
}

function eventDescription(event: ActivityEvent, campaign: (typeof discoveryCampaigns)[number], today: IsoDate): string {
  if (event.kind === 'milestone') {
    return `${event.description} Demo total: $${campaign.raised.toLocaleString()} of $${campaign.goal.toLocaleString()} goal.`;
  }
  if (event.kind === 'deadline') {
    return `${campaign.title} is a fictional demo campaign. ${getDeadlineLabel(campaign.fundingDeadline, today)} (${formatIsoDate(campaign.fundingDeadline)}).`;
  }
  if (event.kind === 'ended') {
    const label = isDeadlineExpired(campaign.fundingDeadline, today) ? 'Funding period ended' : 'The sample funding window has closed';
    return `${label} on ${formatIsoDate(campaign.fundingDeadline)}. Its activity figures are fictional demo data.`;
  }
  return event.description;
}

export default function ActivityScreen() {
  const today = useUtcToday();
  const scrollRef = useRef<ScrollView>(null);
  useWebScrollDiagnostics(scrollRef, 'activity');
  const [selectedFilter, setSelectedFilter] = useState<ActivityFilter>('All');

  const visibleEvents = useMemo(() => events
    .filter((event) => selectedFilter === 'All'
      || (selectedFilter === 'Funding Milestones' ? event.kind === 'milestone' : event.kind !== 'milestone'))
    .sort((left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id)), [selectedFilter]);

  const campaignsById = useMemo(() => new Map(discoveryCampaigns.map((campaign) => [campaign.id, campaign])), []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator>
        <Text style={styles.title}>Activity</Text>
        <Text style={styles.intro}>Follow the progress of campaigns and the messages they aim to amplify.</Text>

        <View style={styles.demoNote}>
          <Text style={styles.demoNoteText}>Fictional demo activity · sample funding figures are not payment records.</Text>
        </View>

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

        {visibleEvents.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No activity yet</Text>
            <Text style={styles.emptyDescription}>There are no items in this activity view right now.</Text>
          </View>
        ) : (
          <View style={styles.timeline}>
            {visibleEvents.map((event, index) => {
              const campaign = campaignsById.get(event.campaignId);
              if (!campaign) return null;
              return (
                <Pressable
                  key={event.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${event.title} for ${campaign.title}. Open campaign details.`}
                  onPress={() => router.push({ pathname: '/campaign/[id]', params: { id: campaign.id } } as never)}
                  style={({ pressed }) => [styles.eventRow, pressed && styles.pressed]}
                >
                  <View style={styles.markerColumn}>
                    <View style={[styles.marker, event.kind === 'milestone' && styles.fundingMarker, event.kind === 'simulated-status' && styles.statusMarker]}>
                      <Text style={styles.markerText}>{event.marker}</Text>
                    </View>
                    {index < visibleEvents.length - 1 && <View style={styles.timelineLine} />}
                  </View>
                  <View style={styles.eventContent}>
                    <View style={styles.eventTopline}>
                      <Text style={styles.eventTitle}>{event.title}</Text>
                      <Text style={styles.eventDate}>{formatEventDate(event.date)}</Text>
                    </View>
                    <Text style={styles.campaignName}>{campaign.title} · {campaign.category}</Text>
                    <Text style={styles.eventDescription}>{eventDescription(event, campaign, today)}</Text>
                    <Text style={styles.openLink}>View campaign →</Text>
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

const styles = StyleSheet.create({
  safe: { flex: 1, minHeight: 0, backgroundColor: C.paper },
  scroll: { flex: 1, minHeight: 0 },
  content: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 128, maxWidth: 680, width: '100%', alignSelf: 'center' },
  title: { color: C.ink, fontSize: 31, lineHeight: 38, fontWeight: '600', letterSpacing: -0.6 },
  intro: { color: C.muted, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 17 },
  demoNote: { backgroundColor: '#E8E1D7', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 7 },
  demoNoteText: { color: C.muted, fontSize: 10, lineHeight: 15 },
  filterList: { gap: 8, paddingVertical: 17 },
  filterChip: { minHeight: 36, justifyContent: 'center', paddingHorizontal: 13, borderWidth: 1, borderColor: C.line, borderRadius: 18, backgroundColor: C.white },
  filterChipSelected: { backgroundColor: C.brown, borderColor: C.brown },
  filterText: { color: C.muted, fontSize: 11, fontWeight: '600' },
  filterTextSelected: { color: C.white },
  listHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 3 },
  listTitle: { color: C.ink, fontSize: 19, fontWeight: '600' },
  count: { color: C.muted, fontSize: 10 },
  timeline: { marginTop: 12 },
  eventRow: { flexDirection: 'row', gap: 12, minHeight: 118 },
  pressed: { opacity: 0.74 },
  markerColumn: { width: 30, alignItems: 'center' },
  marker: { zIndex: 1, width: 29, height: 29, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: C.brownLight, borderWidth: 1, borderColor: '#DFD2C1' },
  fundingMarker: { backgroundColor: '#E6EBDD', borderColor: '#D2DACB' },
  statusMarker: { backgroundColor: '#E8E1D7', borderColor: '#D9CFC2' },
  markerText: { color: C.brown, fontSize: 14, lineHeight: 18, fontWeight: '700' },
  timelineLine: { position: 'absolute', top: 29, bottom: 0, width: 1, backgroundColor: '#D8CFC4' },
  eventContent: { flex: 1, minWidth: 0, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: C.line },
  eventTopline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  eventTitle: { flex: 1, color: C.ink, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  eventDate: { color: C.muted, fontSize: 9, lineHeight: 16, flexShrink: 0 },
  campaignName: { color: C.brown, fontSize: 10, fontWeight: '600', marginTop: 4 },
  eventDescription: { color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 7 },
  openLink: { color: C.brown, fontSize: 10, fontWeight: '700', marginTop: 8 },
  emptyState: { padding: 22, marginTop: 12, borderWidth: 1, borderColor: C.line, borderRadius: 9, backgroundColor: C.white },
  emptyTitle: { color: C.ink, fontSize: 15, fontWeight: '700' },
  emptyDescription: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 5 },
});
