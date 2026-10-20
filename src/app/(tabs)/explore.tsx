import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette as C } from '@/constants/theme';
import {
  discoveryCampaigns,
  discoveryCategories,
  formatEstimatedReachAtGoal,
  getDeadlineLabel,
  isDeadlineExpired,
  newestFirstCampaigns,
  sortOptions,
  type CampaignSort,
  type DiscoveryCampaign,
  type DiscoveryFilter,
} from '@/data/campaigns';
import { useUtcToday } from '@/hooks/use-utc-today';
import { useWebScrollDiagnostics } from '@/hooks/use-web-scroll-diagnostics';
import { readCampaignDemoContributions } from '@/data/demo-contributions';
import { campaignFundingMinorForContribution } from '@/data/demo-reach';
import { formatInrMinor, parseUsdMinor } from '@/data/funding';

const ALL_COUNTRIES = 'All countries';
const EMPTY_CATALOGUE: DiscoveryCampaign[] = [];

type CatalogueStatus = 'loading' | 'success' | 'error';
type ExploreTestState = 'empty' | 'error' | null;
type CatalogueResult = {
  attempt: number;
  testState: ExploreTestState;
  status: Exclude<CatalogueStatus, 'loading'>;
  campaigns: DiscoveryCampaign[];
};

async function loadExploreCatalogue(testState: ExploreTestState, attempt: number): Promise<DiscoveryCampaign[]> {
  // The discovery catalogue is currently bundled demo data. Keep its loader contract
  // asynchronous so status follows this operation if the source later becomes remote.
  if (testState === 'error' && attempt === 0) throw new Error('Development-only Explore catalogue failure.');
  return testState === 'empty' ? [] : discoveryCampaigns;
}

function CampaignCard({ campaign, today, demoRaisedMinor }: { campaign: DiscoveryCampaign; today: `${number}-${number}-${number}`; demoRaisedMinor: number }) {
  const raisedMinor = Math.min(Number.MAX_SAFE_INTEGER, parseUsdMinor(campaign.raised) + demoRaisedMinor);
  const goalMinor = parseUsdMinor(campaign.goal);
  const progress = goalMinor > 0 ? raisedMinor / goalMinor : 0;
  const percent = Math.round(progress * 100);
  const barProgress = Math.max(0, Math.min(progress, 1));
  const expired = isDeadlineExpired(campaign.fundingDeadline, today);
  const eligible = campaign.status !== 'In review' && !expired;
  const deadlineLabel = getDeadlineLabel(campaign.fundingDeadline, today);
  const estimatedReach = formatEstimatedReachAtGoal(campaign);
  return (
    <View style={styles.cardEntry}>
      <View style={styles.card}>
        <View style={styles.cardTopRow}>
          <Image
            source={campaign.image}
            style={[styles.cover, { backgroundColor: campaign.coverColor }]}
            contentFit="cover"
            accessibilityLabel={`Campaign image for ${campaign.title}`}
          />
          <View style={styles.cardBody}>
            <Text style={styles.category}>{campaign.category.toUpperCase()} · {campaign.country.toUpperCase()}</Text>
            <Text style={styles.campaignTitle}>{campaign.title}</Text>
            <Text style={styles.description}>{campaign.description}</Text>
            <Text style={styles.creator}>By {campaign.creator}</Text>
          </View>
        </View>
        <View style={styles.cardFooter}>
          <View style={styles.fundingRow}>
            <Text style={styles.raised}>{formatInrMinor(raisedMinor)} demo raised</Text>
            <Text style={styles.goal}>of {formatInrMinor(goalMinor)}</Text>
          </View>
          <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(barProgress * 100) }} style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${barProgress * 100}%` }]} />
          </View>
          <View style={styles.fundingMeta}>
            <Text style={styles.fundingPercent}>{percent}% funded</Text>
            {campaign.status === 'completed' ? <Text style={styles.completedStatus}>Successfully completed · goal reached</Text> : null}
          </View>
          <Text style={styles.estimate}>Est. reach {estimatedReach === null ? 'unavailable' : `~${estimatedReach}`} · illustrative</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open campaign details for ${campaign.title}. Demo funding only; no payment is made.`}
            accessibilityHint={eligible ? undefined : deadlineLabel}
            style={({ pressed }) => [styles.backCampaignButton, pressed && styles.pressed]}
            onPress={() => router.push({ pathname: '/campaign/[id]', params: { id: campaign.id } } as never)}>
            <Text style={styles.backCampaignButtonText}>View campaign →</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function ExploreScreen() {
  const { exploreTestState: exploreTestStateParam } = useLocalSearchParams<{ exploreTestState?: string }>();
  const testState: ExploreTestState = __DEV__ && (exploreTestStateParam === 'empty' || exploreTestStateParam === 'error')
    ? exploreTestStateParam
    : null;
  const today = useUtcToday();
  const scrollRef = useRef<ScrollView>(null);
  useWebScrollDiagnostics(scrollRef, 'explore');
  const [catalogueResult, setCatalogueResult] = useState<CatalogueResult | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<CampaignSort>('Newest first');
  const [topic, setTopic] = useState<DiscoveryFilter>('All');
  const [country, setCountry] = useState(ALL_COUNTRIES);
  const [draftTopic, setDraftTopic] = useState<DiscoveryFilter>('All');
  const [draftCountry, setDraftCountry] = useState(ALL_COUNTRIES);
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [demoTotals, setDemoTotals] = useState<Record<string, { amountMinor: number; count: number }>>({});

  useEffect(() => {
    let active = true;
    void loadExploreCatalogue(testState, loadAttempt).then((campaigns) => {
      if (!active) return;
      setCatalogueResult({ attempt: loadAttempt, testState, status: 'success', campaigns });
    }).catch(() => {
      if (!active) return;
      setCatalogueResult({ attempt: loadAttempt, testState, status: 'error', campaigns: [] });
    });
    return () => { active = false; };
  }, [loadAttempt, testState]);

  const resultIsCurrent = catalogueResult?.attempt === loadAttempt && catalogueResult.testState === testState;
  const catalogueStatus: CatalogueStatus = resultIsCurrent ? catalogueResult.status : 'loading';
  const catalogue = resultIsCurrent && catalogueStatus === 'success' ? catalogueResult.campaigns : EMPTY_CATALOGUE;

  const retryCatalogueLoad = () => setLoadAttempt((attempt) => attempt + 1);

  useFocusEffect(useCallback(() => {
    let active = true;
    void Promise.all(catalogue.map(async (campaign) => {
      try {
        const items = await readCampaignDemoContributions(campaign.id);
        const amountMinor = items.reduce((total, item) => Math.min(Number.MAX_SAFE_INTEGER, total + campaignFundingMinorForContribution(item)), 0);
        return [campaign.id, { amountMinor, count: items.length }] as const;
      } catch { return [campaign.id, { amountMinor: 0, count: 0 }] as const; }
    })).then((entries) => {
      if (active) setDemoTotals(Object.fromEntries(entries));
    });
    return () => { active = false; };
  }, [catalogue]));

  const countries = useMemo(() => [ALL_COUNTRIES, ...Array.from(new Set(catalogue.map((campaign) => campaign.country))).sort()], [catalogue]);
  const activeFilterCount = Number(topic !== 'All') + Number(country !== ALL_COUNTRIES);

  const visibleCampaigns = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matches = catalogue.filter((campaign) => {
      const matchesTopic = topic === 'All' || campaign.discoveryCategory === topic;
      const matchesCountry = country === ALL_COUNTRIES || campaign.country === country;
      const searchable = [campaign.title, campaign.cause, campaign.description, campaign.category, campaign.discoveryCategory, campaign.creator, campaign.country, ...campaign.keywords]
        .join(' ')
        .toLowerCase();
      return matchesTopic && matchesCountry && (!normalizedQuery || searchable.includes(normalizedQuery));
    });

    if (sort === 'Newest first') return newestFirstCampaigns(matches);

    return matches.sort((left, right) => {
      if (sort === 'Oldest first') return left.createdAt.localeCompare(right.createdAt);

      const leftExpired = isDeadlineExpired(left.fundingDeadline, today);
      const rightExpired = isDeadlineExpired(right.fundingDeadline, today);
      if (leftExpired !== rightExpired) return leftExpired ? 1 : -1;
      if (leftExpired && rightExpired) {
        return left.fundingDeadline.localeCompare(right.fundingDeadline)
          || right.createdAt.localeCompare(left.createdAt)
          || left.id.localeCompare(right.id);
      }

      const deadlineOrder = left.fundingDeadline.localeCompare(right.fundingDeadline);
      return (sort === 'Deadline: soonest first' ? deadlineOrder : -deadlineOrder)
        || right.createdAt.localeCompare(left.createdAt)
        || left.id.localeCompare(right.id);
    });
  }, [catalogue, country, query, sort, today, topic]);

  const openFilter = () => {
    setDraftTopic(topic);
    setDraftCountry(country);
    setFilterOpen(true);
  };

  const resetFilters = () => {
    setTopic('All');
    setCountry(ALL_COUNTRIES);
    setDraftTopic('All');
    setDraftCountry(ALL_COUNTRIES);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator>
        <Text style={styles.title}>Explore Campaigns</Text>
        <Text style={styles.intro}>Discover campaigns worth amplifying.</Text>

        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            accessibilityLabel="Search campaigns"
            value={query}
            onChangeText={setQuery}
            placeholder="Search campaigns, causes, or keywords"
            placeholderTextColor={C.placeholder}
            returnKeyType="search"
            style={styles.searchInput}
          />
          {query.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')} hitSlop={10}><Text style={styles.clearSearch}>×</Text></Pressable>}
        </View>

        <View style={styles.controlsRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Sort campaigns: ${sort}`} onPress={() => setSortOpen(true)} style={({ pressed }) => [styles.control, pressed && styles.pressed]}>
            <Text style={styles.controlLabel}>Sort</Text>
            <Text numberOfLines={1} style={styles.controlValue}>{sort} <Text style={styles.controlChevron}>⌄</Text></Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Filter campaigns by category${activeFilterCount ? `, ${activeFilterCount} active` : ''}`} onPress={openFilter} style={({ pressed }) => [styles.control, pressed && styles.pressed]}>
            <Text style={styles.controlLabel}>Filter</Text>
            <Text numberOfLines={1} style={styles.controlValue}>{activeFilterCount ? `${activeFilterCount} active` : 'Any category · Any country'} <Text style={styles.controlChevron}>⌄</Text></Text>
          </Pressable>
        </View>

        {catalogueStatus === 'loading' ? (
          <View style={styles.catalogueState}>
            <ActivityIndicator color={C.green} size="small" />
            <Text style={styles.stateMessage}>Loading campaigns…</Text>
          </View>
        ) : catalogueStatus === 'error' ? (
          <View style={styles.catalogueState}>
            <Text style={styles.stateMessage}>We couldn’t load campaigns.</Text>
            <Pressable accessibilityRole="button" onPress={retryCatalogueLoad} style={({ pressed }) => [styles.stateAction, pressed && styles.pressed]}>
              <Text style={styles.stateActionText}>Retry</Text>
            </Pressable>
          </View>
        ) : catalogue.length === 0 ? (
          <View style={styles.catalogueState}>
            <Text style={styles.stateMessage}>No campaigns available yet.</Text>
            <Pressable accessibilityRole="button" onPress={retryCatalogueLoad} style={({ pressed }) => [styles.stateAction, pressed && styles.pressed]}>
              <Text style={styles.stateActionText}>Refresh campaigns</Text>
            </Pressable>
          </View>
        ) : visibleCampaigns.length === 0 ? (
          <View style={styles.catalogueState}>
            <Text style={styles.stateMessage}>No campaigns match your search or filters.</Text>
            <Pressable accessibilityRole="button" onPress={() => { setQuery(''); resetFilters(); }} style={({ pressed }) => [styles.stateAction, pressed && styles.pressed]}>
              <Text style={styles.stateActionText}>Clear search and filters</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsCount}>{visibleCampaigns.length} {visibleCampaigns.length === 1 ? 'campaign' : 'campaigns'}</Text>
            </View>
            {visibleCampaigns.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} today={today} demoRaisedMinor={demoTotals[campaign.id]?.amountMinor ?? 0} />)}
          </>
        )}
      </ScrollView>

      <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close sort options" style={styles.scrim} onPress={() => setSortOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeadingRow}>
              <Text style={styles.sheetTitle}>Sort campaigns</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setSortOpen(false)} hitSlop={10}><Text style={styles.closeButton}>×</Text></Pressable>
            </View>
            {sortOptions.map((option) => {
              const selected = option === sort;
              return <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => { setSort(option); setSortOpen(false); }} style={[styles.optionRow, selected && styles.optionSelected]}>
                <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option}</Text>
                <Text style={[styles.optionCheck, selected && styles.optionTextSelected]}>{selected ? '✓' : ''}</Text>
              </Pressable>;
            })}
          </View>
        </View>
      </Modal>

      <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close filters" style={styles.scrim} onPress={() => setFilterOpen(false)} />
          <View style={styles.filterSheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeadingRow}>
              <View><Text style={styles.sheetTitle}>Filter campaigns</Text><Text style={styles.sheetSubtitle}>Choose a category and a country.</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setFilterOpen(false)} hitSlop={10}><Text style={styles.closeButton}>×</Text></Pressable>
            </View>
            <ScrollView style={styles.filterOptionsScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.groupLabel}>CATEGORY</Text>
              <View style={styles.optionsGrid}>
                {discoveryCategories.map((option) => {
                  const selected = option === draftTopic;
                  return <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setDraftTopic(option)} style={[styles.optionChip, selected && styles.optionChipSelected]}>
                    <Text style={[styles.optionChipText, selected && styles.optionChipTextSelected]}>{option}</Text>
                  </Pressable>;
                })}
              </View>
              <Text style={[styles.groupLabel, styles.countryLabel]}>COUNTRY</Text>
              <View style={styles.optionsGrid}>
                {countries.map((option) => {
                  const selected = option === draftCountry;
                  return <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setDraftCountry(option)} style={[styles.optionChip, selected && styles.optionChipSelected]}>
                    <Text style={[styles.optionChipText, selected && styles.optionChipTextSelected]}>{option}</Text>
                  </Pressable>;
                })}
              </View>
            </ScrollView>
            <View style={styles.sheetActions}>
              <Pressable accessibilityRole="button" onPress={resetFilters} style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}><Text style={styles.clearButtonText}>Reset</Text></Pressable>
              <Pressable accessibilityRole="button" onPress={() => { setTopic(draftTopic); setCountry(draftCountry); setFilterOpen(false); }} style={({ pressed }) => [styles.applyButton, pressed && styles.pressed]}><Text style={styles.applyButtonText}>Apply filters</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, minHeight: 0, backgroundColor: C.paper },
  scroll: { flex: 1, minHeight: 0 },
  content: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 24, maxWidth: 680, width: '100%', alignSelf: 'center' },
  title: { color: C.text, fontSize: 31, lineHeight: 38, fontWeight: '600', letterSpacing: -0.6 },
  intro: { color: C.muted, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 20 },
  searchWrap: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.brownLight, borderRadius: 8, backgroundColor: C.paper, paddingHorizontal: 12 },
  searchIcon: { color: C.green, fontSize: 23, marginRight: 8 },
  searchInput: { flex: 1, minWidth: 0, color: C.text, fontSize: 13, paddingVertical: 10 },
  clearSearch: { color: C.muted, fontSize: 21, paddingLeft: 8 },
  controlsRow: { flexDirection: 'row', gap: 10, marginTop: 12, marginBottom: 23 },
  control: { flex: 1, minWidth: 0, minHeight: 54, justifyContent: 'center', borderWidth: 1, borderColor: C.green, borderRadius: 8, backgroundColor: C.green, paddingHorizontal: 12, paddingVertical: 7 },
  controlLabel: { color: C.paper, fontSize: 10, marginBottom: 3 },
  controlValue: { color: C.paper, fontSize: 11, fontWeight: '700' },
  controlChevron: { color: C.paper, fontSize: 12 },
  resultsHeader: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'baseline', marginBottom: 11 },
  resultsCount: { color: C.muted, fontSize: 11 },
  catalogueState: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 30, paddingHorizontal: 16 },
  stateMessage: { color: C.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  stateAction: { minHeight: 38, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: 18, backgroundColor: C.green },
  stateActionText: { color: C.paper, fontSize: 12, fontWeight: '700' },
  cardEntry: { marginBottom: 14 },
  card: { overflow: 'hidden', borderWidth: 1, borderColor: C.line, borderRadius: 9, backgroundColor: C.surface },
  cardTopRow: { flexDirection: 'row', alignItems: 'stretch' },
  pressed: { opacity: 0.78 },
  cover: { width: 100, alignSelf: 'stretch' },
  cardBody: { flex: 1, minWidth: 0, padding: 12, gap: 6 },
  cardFooter: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 12, gap: 6 },
  category: { color: C.green, fontSize: 9, lineHeight: 13, letterSpacing: 0.7, fontWeight: '700' },
  campaignTitle: { color: C.text, fontSize: 16, lineHeight: 20, fontWeight: '700' },
  description: { color: C.muted, fontSize: 11, lineHeight: 15 },
  creator: { color: C.maroon, fontSize: 10, lineHeight: 14, fontWeight: '600' },
  fundingRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'baseline', gap: 4 },
  raised: { color: C.text, fontSize: 11, lineHeight: 15, fontWeight: '700' },
  goal: { color: C.muted, fontSize: 10, lineHeight: 14 },
  progressTrack: { height: 4, borderRadius: 3, backgroundColor: C.brownLight, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: C.green, borderRadius: 3 },
  fundingMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 10, rowGap: 2 },
  fundingPercent: { color: C.text, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  completedStatus: { color: C.green, fontSize: 11, lineHeight: 16, fontWeight: '700' },
  estimate: { color: C.muted, fontSize: 10, lineHeight: 14 },
  backCampaignButton: { minHeight: 36, alignSelf: 'flex-start', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13, borderRadius: 18, backgroundColor: C.green, marginTop: 2 },
  backCampaignButtonText: { color: C.paper, fontSize: 11, lineHeight: 15, fontWeight: '700' },
  modalRoot: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(41,43,36,0.42)' },
  sheet: { width: '100%', maxWidth: 560, backgroundColor: C.paper, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 28 },
  filterSheet: { width: '100%', maxWidth: 560, maxHeight: '88%', backgroundColor: C.paper, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 20 },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, backgroundColor: C.line, alignSelf: 'center', marginBottom: 14 },
  sheetHeadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { color: C.text, fontSize: 20, fontWeight: '700' },
  sheetSubtitle: { color: C.muted, fontSize: 12, marginTop: 4 },
  closeButton: { color: C.muted, fontSize: 26, paddingHorizontal: 5 },
  optionRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.line, paddingHorizontal: 10 },
  optionSelected: { backgroundColor: C.brownLight, borderRadius: 6, borderBottomColor: 'transparent' },
  optionText: { color: C.text, fontSize: 14 },
  optionTextSelected: { color: C.text, fontWeight: '700' },
  optionCheck: { color: C.text, fontSize: 15, fontWeight: '700' },
  filterOptionsScroll: { flexShrink: 1 },
  groupLabel: { color: C.text, fontSize: 10, fontWeight: '700', letterSpacing: 1, marginTop: 8, marginBottom: 10 },
  countryLabel: { marginTop: 20 },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: { borderWidth: 1, borderColor: C.line, borderRadius: 18, backgroundColor: C.surface, paddingHorizontal: 12, paddingVertical: 8 },
  optionChipSelected: { backgroundColor: C.maroonLight, borderColor: C.maroonLight },
  optionChipText: { color: C.muted, fontSize: 12 },
  optionChipTextSelected: { color: C.maroon, fontWeight: '700' },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  clearButton: { width: 100, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 7, borderWidth: 1, borderColor: C.brown },
  clearButtonText: { color: C.text, fontSize: 13, fontWeight: '700' },
  applyButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: C.brown },
  applyButtonText: { color: C.paper, fontSize: 13, fontWeight: '700' },
});
