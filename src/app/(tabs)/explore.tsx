import { router } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import { Palette as C } from '@/constants/theme';
import {
  discoveryCampaigns,
  discoveryCategories,
  formatIsoDate,
  getDeadlineLabel,
  isDeadlineExpired,
  sortOptions,
  type CampaignSort,
  type DiscoveryCampaign,
  type DiscoveryFilter,
} from '@/data/campaigns';
import { useUtcToday } from '@/hooks/use-utc-today';
import { useWebScrollDiagnostics } from '@/hooks/use-web-scroll-diagnostics';
import { readCampaignDemoContributions } from '@/data/demo-contributions';
import { parseUsdMinor } from '@/data/funding';

const ALL_COUNTRIES = 'All countries';

function CampaignCard({ campaign, today, demoRaisedMinor, demoContributionCount }: { campaign: DiscoveryCampaign; today: `${number}-${number}-${number}`; demoRaisedMinor: number; demoContributionCount: number }) {
  const raisedMinor = Math.min(Number.MAX_SAFE_INTEGER, parseUsdMinor(campaign.raised) + demoRaisedMinor);
  const goalMinor = parseUsdMinor(campaign.goal);
  const progress = goalMinor > 0 ? Math.min(raisedMinor / goalMinor, 1) : 0;
  const expired = isDeadlineExpired(campaign.fundingDeadline, today);
  const eligible = campaign.status !== 'In review' && !expired;
  const deadlineLabel = getDeadlineLabel(campaign.fundingDeadline, today);
  return (
    <View style={styles.cardEntry}>
      <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open campaign: ${campaign.title}. ${deadlineLabel}.`}
      onPress={() => router.push({ pathname: '/campaign/[id]', params: { id: campaign.id } } as never)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={[styles.cover, { backgroundColor: campaign.coverColor }]}>
        <View style={styles.coverEmblem}><Text style={styles.coverSymbol}>{campaign.coverSymbol}</Text></View>
        <Text style={styles.coverCaption}>ILLUSTRATIVE COVER · FICTIONAL DEMO</Text>
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTopline}>
          <Text style={styles.category}>{campaign.category.toUpperCase()}</Text>
          <Text style={styles.status}>{campaign.status}</Text>
        </View>
        <Text style={styles.campaignTitle}>{campaign.title}</Text>
        <Text style={styles.cause}>{campaign.cause} · {campaign.country}</Text>
        <Text style={styles.description}>{campaign.description}</Text>
        <Text style={styles.creator}>By {campaign.creator}</Text>
        <View style={styles.platformRow}>
          <Text style={styles.platformLabel}>Planned distribution</Text>
          <Text style={styles.platform}>{campaign.platform}</Text>
        </View>
        <View style={styles.fundingRow}>
          <Text style={styles.raised}>${(raisedMinor / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} <Text style={styles.raisedHint}>demo total</Text></Text>
          <Text style={styles.goal}>of ${campaign.goal.toLocaleString()} demo goal</Text>
        </View>
        <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.estimate}>{demoContributionCount} simulated demo {demoContributionCount === 1 ? 'contribution' : 'contributions'} · no payments</Text>
        <Text style={styles.estimate}>Estimated potential reach at goal: ~{campaign.estimatedReachAtGoal.toLocaleString()} <Text style={styles.estimateHint}>· illustrative, not guaranteed</Text></Text>
        <View style={[styles.deadlineRow, expired && styles.expiredDeadline]}>
          <Text style={[styles.deadlineLabel, expired && styles.expiredDeadlineLabel]}>{deadlineLabel}</Text>
          <Text style={[styles.deadlineDate, expired && styles.expiredDeadlineLabel]}>{formatIsoDate(campaign.fundingDeadline)}</Text>
        </View>
        <Text style={styles.detailLink}>View campaign details →</Text>
      </View>
      </Pressable>
      {eligible ? <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Back this Campaign: ${campaign.title}. Demo contribution only.`}
        onPress={() => router.push({ pathname: '/campaign/[id]', params: { id: campaign.id } } as never)}
        style={({ pressed }) => [styles.backCampaignButton, pressed && styles.pressed]}>
        <Text style={styles.backCampaignButtonText}>Back this Campaign</Text>
      </Pressable> : null}
    </View>
  );
}

export default function ExploreScreen() {
  const today = useUtcToday();
  const scrollRef = useRef<ScrollView>(null);
  useWebScrollDiagnostics(scrollRef, 'explore');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<CampaignSort>('Newest first');
  const [topic, setTopic] = useState<DiscoveryFilter>('All');
  const [country, setCountry] = useState(ALL_COUNTRIES);
  const [draftTopic, setDraftTopic] = useState<DiscoveryFilter>('All');
  const [draftCountry, setDraftCountry] = useState(ALL_COUNTRIES);
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [demoTotals, setDemoTotals] = useState<Record<string, { amountMinor: number; count: number }>>({});

  useFocusEffect(useCallback(() => {
    let active = true;
    void Promise.all(discoveryCampaigns.map(async (campaign) => {
      try {
        const items = await readCampaignDemoContributions(campaign.id);
        const amountMinor = items.reduce((total, item) => Math.min(Number.MAX_SAFE_INTEGER, total + item.amountMinor), 0);
        return [campaign.id, { amountMinor, count: items.length }] as const;
      } catch { return [campaign.id, { amountMinor: 0, count: 0 }] as const; }
    })).then((entries) => {
      if (active) setDemoTotals(Object.fromEntries(entries));
    });
    return () => { active = false; };
  }, []));

  const countries = useMemo(() => [ALL_COUNTRIES, ...Array.from(new Set(discoveryCampaigns.map((campaign) => campaign.country))).sort()], []);
  const activeFilterCount = Number(topic !== 'All') + Number(country !== ALL_COUNTRIES);

  const visibleCampaigns = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const matches = discoveryCampaigns.filter((campaign) => {
      const matchesTopic = topic === 'All' || campaign.category === topic;
      const matchesCountry = country === ALL_COUNTRIES || campaign.country === country;
      const searchable = [campaign.title, campaign.cause, campaign.description, campaign.category, campaign.creator, campaign.country, ...campaign.keywords]
        .join(' ')
        .toLowerCase();
      return matchesTopic && matchesCountry && (!normalizedQuery || searchable.includes(normalizedQuery));
    });

    return matches.sort((left, right) => {
      if (sort === 'Newest first') return right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id);
      if (sort === 'Oldest first') return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);

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
  }, [country, query, sort, today, topic]);

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
          <Pressable accessibilityRole="button" accessibilityLabel={`Filter campaigns${activeFilterCount ? `, ${activeFilterCount} active` : ''}`} onPress={openFilter} style={({ pressed }) => [styles.control, pressed && styles.pressed]}>
            <Text style={styles.controlLabel}>Filter</Text>
            <Text numberOfLines={1} style={styles.controlValue}>{activeFilterCount ? `${activeFilterCount} active` : 'Any topic · Any country'} <Text style={styles.controlChevron}>⌄</Text></Text>
          </Pressable>
        </View>

        <View style={styles.resultsHeader}>
          <Text style={styles.resultsTitle}>Campaigns</Text>
          <Text style={styles.resultsCount}>{visibleCampaigns.length} {visibleCampaigns.length === 1 ? 'campaign' : 'campaigns'}</Text>
        </View>
        <View style={styles.demoNotice}>
          <Text style={styles.demoNoticeText}>Fictional demo campaigns by different fictional creators. Eligible campaign details let you record a local simulated contribution; no payment is made. Funding supports message distribution and amplification, not a direct donation to the underlying cause. No ads are running through SIGNAL.</Text>
        </View>

        {visibleCampaigns.length > 0 ? visibleCampaigns.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} today={today} demoRaisedMinor={demoTotals[campaign.id]?.amountMinor ?? 0} demoContributionCount={demoTotals[campaign.id]?.count ?? 0} />) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyMark}><Text style={styles.emptyMarkText}>⌕</Text></View>
            <Text style={styles.emptyTitle}>No campaigns found</Text>
            <Text style={styles.emptyCopy}>Try another search, topic, or country to discover more messages.</Text>
            <Pressable accessibilityRole="button" onPress={() => { setQuery(''); resetFilters(); }} style={({ pressed }) => [styles.resetButton, pressed && styles.pressed]}>
              <Text style={styles.resetButtonText}>Clear search and filters</Text>
            </Pressable>
          </View>
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
              <View><Text style={styles.sheetTitle}>Filter campaigns</Text><Text style={styles.sheetSubtitle}>Choose a topic and a country.</Text></View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => setFilterOpen(false)} hitSlop={10}><Text style={styles.closeButton}>×</Text></Pressable>
            </View>
            <ScrollView style={styles.filterOptionsScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.groupLabel}>TOPIC</Text>
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
  content: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 120, maxWidth: 680, width: '100%', alignSelf: 'center' },
  title: { color: C.text, fontSize: 31, lineHeight: 38, fontWeight: '600', letterSpacing: -0.6 },
  intro: { color: C.muted, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 20 },
  searchWrap: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 8, backgroundColor: C.surface, paddingHorizontal: 12 },
  searchIcon: { color: C.text, fontSize: 23, marginRight: 8 },
  searchInput: { flex: 1, minWidth: 0, color: C.text, fontSize: 13, paddingVertical: 10 },
  clearSearch: { color: C.muted, fontSize: 21, paddingLeft: 8 },
  controlsRow: { flexDirection: 'row', gap: 10, marginTop: 12, marginBottom: 23 },
  control: { flex: 1, minWidth: 0, minHeight: 54, justifyContent: 'center', borderWidth: 1, borderColor: C.line, borderRadius: 8, backgroundColor: C.surface, paddingHorizontal: 12, paddingVertical: 7 },
  controlLabel: { color: C.muted, fontSize: 10, marginBottom: 3 },
  controlValue: { color: C.text, fontSize: 11, fontWeight: '700' },
  controlChevron: { color: C.text, fontSize: 12 },
  resultsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 11 },
  resultsTitle: { color: C.text, fontSize: 20, fontWeight: '600' },
  resultsCount: { color: C.muted, fontSize: 11 },
  demoNotice: { backgroundColor: C.surfaceSoft, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 7, marginBottom: 14 },
  demoNoticeText: { color: C.muted, fontSize: 10, lineHeight: 15 },
  cardEntry: { marginBottom: 14 },
  card: { overflow: 'hidden', borderWidth: 1, borderColor: C.line, borderRadius: 9, backgroundColor: C.surface },
  pressed: { opacity: 0.78 },
  cover: { height: 112, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  coverEmblem: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 27, backgroundColor: 'rgba(116,86,63,0.88)' },
  coverSymbol: { color: C.text, fontSize: 30, lineHeight: 34 },
  coverCaption: { position: 'absolute', right: 10, bottom: 9, color: 'rgba(48,42,37,0.55)', fontSize: 8, fontWeight: '700', letterSpacing: 0.8 },
  cardBody: { padding: 15 },
  cardTopline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 7 },
  category: { color: C.green, fontSize: 9, letterSpacing: 1, fontWeight: '700', flexShrink: 1 },
  status: { color: C.text, backgroundColor: C.brownLight, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, fontSize: 9, fontWeight: '600', overflow: 'hidden' },
  campaignTitle: { color: C.text, fontSize: 19, lineHeight: 24, fontWeight: '600' },
  cause: { color: C.text, fontSize: 11, fontWeight: '600', marginTop: 3 },
  description: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: 9 },
  creator: { color: C.muted, fontSize: 10, marginTop: 7 },
  platformRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 13, marginBottom: 13, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: C.surfaceSoft, borderRadius: 6 },
  platformLabel: { color: C.muted, fontSize: 10 },
  platform: { color: C.text, fontSize: 11, fontWeight: '700' },
  fundingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 7 },
  raised: { color: C.text, fontSize: 13, fontWeight: '700' },
  raisedHint: { color: C.muted, fontSize: 10, fontWeight: '400' },
  goal: { color: C.muted, fontSize: 10 },
  progressTrack: { height: 5, borderRadius: 4, backgroundColor: C.surfaceSoft, overflow: 'hidden' },
  progressFill: { height: 5, backgroundColor: C.green, borderRadius: 4 },
  estimate: { color: C.text, fontSize: 10, marginTop: 9 },
  estimateHint: { color: C.muted },
  deadlineRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 11, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6, backgroundColor: C.surfaceSoft },
  deadlineLabel: { color: C.green, fontSize: 11, fontWeight: '700' },
  deadlineDate: { color: C.muted, fontSize: 10 },
  expiredDeadline: { backgroundColor: '#76594B' },
  expiredDeadlineLabel: { color: C.red },
  detailLink: { color: C.text, fontSize: 11, fontWeight: '700', marginTop: 13 },
  backCampaignButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, borderRadius: 22, backgroundColor: C.green, marginTop: 9 },
  backCampaignButtonText: { color: '#FFFFFF', fontSize: 13, lineHeight: 18, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 34, borderWidth: 1, borderColor: C.line, borderRadius: 9, backgroundColor: C.surface, marginTop: 2 },
  emptyMark: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.brownLight, alignItems: 'center', justifyContent: 'center' },
  emptyMarkText: { color: C.text, fontSize: 24 },
  emptyTitle: { color: C.text, fontSize: 17, fontWeight: '700', marginTop: 12 },
  emptyCopy: { color: C.muted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  resetButton: { paddingHorizontal: 16, paddingVertical: 9, marginTop: 15, backgroundColor: C.brown, borderRadius: 6 },
  resetButtonText: { color: C.espresso, fontSize: 11, fontWeight: '700' },
  modalRoot: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(34,29,25,0.42)' },
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
  optionChipSelected: { backgroundColor: C.brown, borderColor: C.brown },
  optionChipText: { color: C.muted, fontSize: 12 },
  optionChipTextSelected: { color: C.espresso, fontWeight: '700' },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  clearButton: { width: 100, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 7, borderWidth: 1, borderColor: C.brown },
  clearButtonText: { color: C.text, fontSize: 13, fontWeight: '700' },
  applyButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: C.brown },
  applyButtonText: { color: C.espresso, fontSize: 13, fontWeight: '700' },
});
