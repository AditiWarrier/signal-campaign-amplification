import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/auth-context';
import { Palette as C, MaxContentWidth, Spacing } from '@/constants/theme';
import { clearCampaignDraft, readCampaignDraft, readCampaignSubmission, readCampaignSubmissions, writeCampaignDraft, writeCampaignSubmission } from '@/data/campaign-draft-storage';
import { isSignalApiConfigured, listCampaignDraftsFromApi, saveCampaignDraftToApi, syncCampaignSubmissionToApi } from '@/data/signal-api';
import { recordLocalCampaignSubmission } from '@/data/local-activity';
import { useWebScrollDiagnostics } from '@/hooks/use-web-scroll-diagnostics';
import { DEMO_REACH_PER_DOLLAR, normalizeLocalCampaignDraft, type LocalCampaignDraft, type LocalSource, type LocalStorySection } from '@/types/local-campaign';
import type { DistributionChannel } from '@/types/campaign';

const CATEGORIES: NonNullable<LocalCampaignDraft['category']>[] = ['Environment', 'Education', 'Community', 'Human Rights'];
const LOCATIONS = ['Canada', 'India', 'Singapore', 'South Africa', 'New Zealand'];
const CHANNELS: { id: DistributionChannel; label: string }[] = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
];
const MAX_DRAFT_SIZE = 48_000;

function newDraft(): LocalCampaignDraft {
  return {
    id: `campaign-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    version: 1, currentStep: 0, localStatus: 'draft', title: '', category: '', creatorName: '', summary: '', coverUri: '', coverAlt: '',
    storyHeadline: '', introduction: '', sections: [], sources: [], audienceActions: '', adHeadline: '', adDescription: '',
    callToAction: 'Learn more', adImageUri: '', adImageAlt: '', adImageMetadata: '', locations: [], minimumAge: '', maximumAge: '',
    interests: '', channels: [], durationDays: '14', instagramBudget: '', facebookBudget: '', fundingGoal: '', policyAccepted: false,
  };
}

function validImageReference(value: string): boolean {
  if (!value.trim()) return true;
  const lower = value.trim().toLowerCase().split(/[?#]/)[0];
  return /\.(jpg|jpeg|png|webp)$/.test(lower);
}

function validHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function money(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function Field({ label, value, onChangeText, placeholder, multiline, maxLength, keyboardType, helper, error, testID }: {
  label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; multiline?: boolean;
  maxLength?: number; keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'url'; helper?: string; error?: string; testID?: string;
}) {
  return <View style={styles.field}>
    <View style={styles.fieldLabelRow}><Text style={styles.fieldLabel}>{label}</Text>{maxLength ? <Text style={styles.counter}>{value.length}/{maxLength}</Text> : null}</View>
    <TextInput
      testID={testID}
      accessibilityLabel={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={C.muted}
      multiline={multiline}
      maxLength={maxLength}
      keyboardType={keyboardType}
      textAlignVertical={multiline ? 'top' : 'center'}
      style={[styles.input, multiline && styles.multiline, error && styles.inputError]}
    />
    {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    {error ? <Text style={styles.errorText}>{error}</Text> : null}
  </View>;
}

function Choice({ label, selected, onPress, accessibilityLabel }: { label: string; selected: boolean; onPress: () => void; accessibilityLabel?: string }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={accessibilityLabel ?? label} onPress={onPress} style={[styles.choice, selected && styles.choiceSelected]}>
    <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
  </Pressable>;
}

function ActionButton({ label, onPress, kind = 'primary', disabled = false }: { label: string; onPress: () => void; kind?: 'primary' | 'secondary' | 'quiet'; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionButton, styles[`action_${kind}`], disabled && styles.disabled, pressed && !disabled && styles.pressed]}>
    <Text style={[styles.actionText, kind !== 'primary' && styles.actionTextSecondary]}>{label}</Text>
  </Pressable>;
}

export default function CreateScreen() {
  const { user, session, isLoading: authLoading } = useAuth();
  const { newDraft: newDraftParam } = useLocalSearchParams<{ newDraft?: string }>();
  const userId = user?.id ?? 'device-draft';
  const scrollRef = useRef<ScrollView>(null);
  useWebScrollDiagnostics(scrollRef, 'create');
  const [draft, setDraft] = useState<LocalCampaignDraft>(newDraft);
  const [flowStarted, setFlowStarted] = useState(false);
  const [ready, setReady] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [entryNotice, setEntryNotice] = useState('');
  const [saveNotice, setSaveNotice] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const backendSyncError = useRef('');

  useEffect(() => {
    let mounted = true;
    if (authLoading) return () => { mounted = false; };
    void readCampaignDraft(userId).then(async (raw) => {
      if (!mounted) return;
      let recoveredLocal = false;
      if (raw && raw.length <= MAX_DRAFT_SIZE) {
        try {
          const savedValue: unknown = JSON.parse(raw);
          let parsed = normalizeLocalCampaignDraft(savedValue);
          if (parsed?.localStatus === 'submitted_locally' && savedValue && typeof savedValue === 'object' && !('id' in savedValue)) {
            const entries = await readCampaignSubmissions(userId);
            const matches = entries.filter((entry) => entry.title === parsed?.title && entry.category === parsed?.category && entry.creatorName === parsed?.creatorName);
            if (matches.length === 1) parsed = await readCampaignSubmission(userId, matches[0].id) ?? parsed;
          }
          if (parsed) {
            setDraft(parsed);
            setHasDraft(true);
            setFlowStarted(false);
            recoveredLocal = true;
          }
        } catch {
          setEntryNotice('A saved draft could not be opened. Start a new draft to continue.');
        }
      }
      if (!recoveredLocal && session?.access_token && isSignalApiConfigured()) {
        try {
          const drafts = await listCampaignDraftsFromApi(session.access_token);
          const remote = drafts[0];
          if (remote && mounted) {
            setDraft(remote);
            setHasDraft(true);
            setFlowStarted(false);
            setEntryNotice('Recovered your saved campaign draft from the SIGNAL API.');
            void writeCampaignDraft(userId, JSON.stringify(remote)).catch(() => undefined);
          }
        } catch {
          // Keep the existing device draft or empty flow available when the API is offline.
        }
      }
    }).catch(() => {
      if (mounted) setEntryNotice('Local draft storage is unavailable. You can still work in this session, but changes may not survive closing the app.');
    }).finally(() => { if (mounted) setReady(true); });
    return () => { mounted = false; };
  }, [authLoading, session?.access_token, userId]);

  useEffect(() => {
    if (!ready || !newDraftParam) return;
    void clearCampaignDraft(userId);
    setDraft(newDraft());
    setHasDraft(false);
    setFlowStarted(false);
    setErrors([]);
    setEntryNotice('New editable draft. Your previous local submission remains available in My Campaigns.');
  }, [newDraftParam, ready, userId]);

  const persist = useCallback((value: LocalCampaignDraft, syncBackend = true) => {
    const serialized = JSON.stringify(value);
    saveQueue.current = saveQueue.current.catch(() => undefined).then(async () => {
      await writeCampaignDraft(userId, serialized);
      backendSyncError.current = '';
      if (!syncBackend || !session?.access_token || !isSignalApiConfigured() || value.localStatus === 'submitted_locally') return;
      try {
        await saveCampaignDraftToApi(value, session.access_token);
      } catch (error) {
        backendSyncError.current = error instanceof Error ? error.message : 'Backend draft sync failed. Your device-local draft is saved.';
      }
    });
    return saveQueue.current;
  }, [session?.access_token, userId]);

  useEffect(() => {
    if (!ready || !flowStarted || draft.localStatus === 'submitted_locally') return;
    const timer = setTimeout(() => {
      void persist(draft).then(() => {
        setHasDraft(true);
        setSaveNotice(backendSyncError.current || (isSignalApiConfigured() && session?.access_token ? 'Draft saved on this device and synced to the SIGNAL API.' : 'Draft saved on this device'));
      }).catch((error: unknown) => {
        setSaveNotice(error instanceof Error ? error.message : 'Draft could not be saved locally.');
      });
    }, 700);
    return () => clearTimeout(timer);
  }, [draft, flowStarted, persist, ready, session?.access_token]);

  const patchDraft = useCallback((patch: Partial<LocalCampaignDraft>) => {
    setDraft((current) => ({ ...current, ...patch, localStatus: 'draft' }));
    setErrors([]);
    setSaveNotice('');
  }, []);

  const allocated = useMemo(() => money(draft.instagramBudget) + money(draft.facebookBudget), [draft.facebookBudget, draft.instagramBudget]);
  const estimatedReach = Math.round(allocated * DEMO_REACH_PER_DOLLAR);

  function openFlow(method: 'manual' | 'voice') {
    setEntryNotice(method === 'voice'
      ? 'Voice transcription and AI are not configured yet. Continue with this editable manual draft; you can enter or paste your story below.'
      : 'Your draft saves on this device as you work.');
    setDraft((current) => ({ ...(hasDraft ? current : newDraft()), currentStep: 1, localStatus: 'draft' }));
    setFlowStarted(true);
    setErrors([]);
  }

  function resumeDraft() {
    setDraft((current) => ({ ...current, localStatus: 'draft' }));
    setFlowStarted(true);
    setEntryNotice('Recovered your saved campaign draft.');
    setErrors([]);
  }

  function nextStep() {
    const found = validateStep(draft.currentStep, draft);
    if (found.length) { setErrors(found); scrollRef.current?.scrollTo({ y: 0, animated: true }); return; }
    patchDraft({ currentStep: Math.min(5, draft.currentStep + 1) });
    setPreviewOpen(false);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  function goBack() {
    setErrors([]);
    if (draft.currentStep <= 1) return;
    patchDraft({ currentStep: draft.currentStep - 1 });
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }

  async function saveAndExit() {
    try {
      const next = { ...draft, localStatus: 'draft' as const };
      await persist(next);
      setDraft(next);
      setHasDraft(true);
      setFlowStarted(false);
      setEntryNotice('Draft saved on this device. Continue whenever you are ready.');
      setSaveNotice(backendSyncError.current);
    } catch (error) {
      setSaveNotice(error instanceof Error ? error.message : 'Draft could not be saved locally.');
    }
  }

  async function submitLocally() {
    const found = [
      ...validateStep(1, draft), ...validateStep(2, draft), ...validateStep(3, draft), ...validateStep(4, draft),
      ...validateStep(5, draft),
    ];
    if (found.length) { setErrors(Array.from(new Set(found))); return; }
    let submitted: LocalCampaignDraft = { ...draft, currentStep: 5, localStatus: 'submitted_locally', apiSubmissionStatus: 'local_only' };
    try {
      await persist(submitted, false);
      let localArchiveWarning = '';
      try { await writeCampaignSubmission(userId, submitted); }
      catch { localArchiveWarning = 'Your submitted campaign is saved on this device, but its submission archive could not be updated. Keep this record on this device until storage is available.'; }
      let localActivityWarning = '';
      try {
        await recordLocalCampaignSubmission(userId, submitted);
      } catch {
        localActivityWarning = 'The campaign is saved, but its on-device Activity event could not be stored.';
      }
      if (isSignalApiConfigured() && session?.access_token) {
        try {
          await syncCampaignSubmissionToApi(submitted, session.access_token);
          submitted = { ...submitted, apiSubmissionStatus: 'submitted' };
        } catch (error) {
          submitted = { ...submitted, apiSubmissionStatus: 'sync_failed' };
          backendSyncError.current = error instanceof Error ? error.message : 'Backend submission could not be confirmed. Your device-local submission is saved.';
        }
      }
      try { await writeCampaignSubmission(userId, submitted); }
      catch { localArchiveWarning = 'Your submitted campaign is saved on this device, but its submission archive could not be updated. Keep this record on this device until storage is available.'; }
      await persist(submitted, false);
      setDraft(submitted);
      setHasDraft(true);
      setErrors([]);
      setSaveNotice(backendSyncError.current || localArchiveWarning || localActivityWarning);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch (error) {
      setSaveNotice(error instanceof Error ? error.message : 'The local submission could not be saved.');
    }
  }

  async function retrySubmissionSync() {
    if (!session?.access_token || !isSignalApiConfigured()) {
      setSaveNotice('Configure EXPO_PUBLIC_SIGNAL_API_URL and sign in before retrying backend sync. Your local campaign is preserved.');
      return;
    }
    const pending = { ...draft, localStatus: 'submitted_locally' as const };
    let localActivityWarning = '';
    try {
      try { await recordLocalCampaignSubmission(userId, pending); }
      catch { localActivityWarning = 'The campaign is preserved, but its on-device Activity event could not be stored.'; }
      await syncCampaignSubmissionToApi(pending, session.access_token);
      const synced = { ...pending, apiSubmissionStatus: 'submitted' as const };
      await writeCampaignSubmission(userId, synced);
      await persist(synced, false);
      backendSyncError.current = '';
      setDraft(synced);
      setSaveNotice(localActivityWarning || 'Backend submission confirmed.');
    } catch (error) {
      const failed = { ...pending, apiSubmissionStatus: 'sync_failed' as const };
      backendSyncError.current = error instanceof Error ? error.message : 'Backend submission could not be confirmed. Your device-local submission is saved.';
      try {
        await writeCampaignSubmission(userId, failed);
        await persist(failed, false);
        setDraft(failed);
      } catch {
        // The prior local submission remains available if updating its sync marker fails.
      }
      setSaveNotice(backendSyncError.current);
    }
  }

  async function startNewDraft() {
    if (draft.localStatus === 'submitted_locally') {
      try { await writeCampaignSubmission(userId, draft); }
      catch (error) {
        setSaveNotice(error instanceof Error ? error.message : 'The saved campaign could not be archived. It remains available on this device.');
        return;
      }
    }
    try { await clearCampaignDraft(userId); } catch { /* Continue with a clean in-memory draft. */ }
    const fresh = newDraft();
    setDraft(fresh);
    setHasDraft(false);
    setFlowStarted(false);
    setEntryNotice('New editable draft. Voice and AI services are not configured.');
  }

  const updateSection = (id: string, patch: Partial<LocalStorySection>) => patchDraft({ sections: draft.sections.map((item) => item.id === id ? { ...item, ...patch } : item) });
  const updateSource = (id: string, patch: Partial<LocalSource>) => patchDraft({ sources: draft.sources.map((item) => item.id === id ? { ...item, ...patch } : item) });

  if (!ready || authLoading) return <SafeAreaView style={styles.safe}><View style={styles.loading}><Text style={styles.body}>Opening your local draft…</Text></View></SafeAreaView>;

  return <SafeAreaView style={styles.safe}>
    <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <View style={styles.page}>
        <Text style={styles.wordmark}>SIGNAL</Text>
        {draft.localStatus === 'submitted_locally' ? <LocalConfirmation draft={draft} syncMessage={saveNotice} canRetry={Boolean(session?.access_token && isSignalApiConfigured())} onRetry={() => { void retrySubmissionSync(); }} onNewDraft={() => { void startNewDraft(); }} /> : !flowStarted ? (
          <EntryScreen
            hasDraft={hasDraft}
            draft={draft}
            notice={entryNotice}
            onManual={() => openFlow('manual')}
            onVoice={() => openFlow('voice')}
            onResume={resumeDraft}
            onViewDraft={() => router.push({ pathname: '/campaign/[id]', params: { id: `local-${draft.id}` } } as never)}
            onNewDraft={() => { void startNewDraft(); }}
          />
        ) : <>
          <View style={styles.progressHeader}>
            <Text style={styles.pageTitle}>Create a campaign</Text>
            <Text style={styles.stepCount}>STEP {draft.currentStep} OF 5</Text>
          </View>
          <View accessibilityRole="progressbar" accessibilityLabel={`Campaign creation step ${draft.currentStep} of 5`} accessibilityValue={{ min: 0, max: 5, now: draft.currentStep }} style={styles.progressTrack}>
            {Array.from({ length: 5 }, (_, index) => <View key={index} style={[styles.progressSegment, index < draft.currentStep && styles.progressSegmentActive]} />)}
          </View>
          <View style={styles.stepLabels}>{['Basics', 'Story', 'Visuals', 'Reach', 'Review'].map((label, index) => <Text key={label} style={[styles.stepLabel, index + 1 === draft.currentStep && styles.stepLabelCurrent]}>{label}</Text>)}</View>
          {entryNotice ? <Text style={styles.notice}>{entryNotice}</Text> : null}
          {saveNotice ? <Text accessibilityRole="alert" style={styles.saveNotice}>{saveNotice}</Text> : null}
          {errors.length > 0 ? <View accessibilityRole="alert" style={styles.errorBox}><Text style={styles.errorTitle}>Please fix these items:</Text>{errors.map((error) => <Text key={error} style={styles.errorText}>• {error}</Text>)}</View> : null}

          {draft.currentStep === 1 ? <StepBasics draft={draft} patchDraft={patchDraft} /> : null}
          {draft.currentStep === 2 ? <StepStory draft={draft} patchDraft={patchDraft} updateSection={updateSection} updateSource={updateSource} /> : null}
          {draft.currentStep === 3 ? <StepVisuals draft={draft} patchDraft={patchDraft} /> : null}
          {draft.currentStep === 4 ? <StepReach draft={draft} patchDraft={patchDraft} allocated={allocated} estimatedReach={estimatedReach} /> : null}
          {draft.currentStep === 5 ? <StepReview draft={draft} patchDraft={patchDraft} allocated={allocated} estimatedReach={estimatedReach} previewOpen={previewOpen} setPreviewOpen={setPreviewOpen} /> : null}

          <View style={styles.footerActions}>
            <View style={styles.footerTop}>
              {draft.currentStep > 1 ? <ActionButton label="Back" kind="secondary" onPress={goBack} /> : <ActionButton label="Save as Draft" kind="secondary" onPress={() => { void saveAndExit(); }} />}
              {draft.currentStep < 5 ? <ActionButton label={draft.currentStep === 1 ? 'Continue' : 'Continue'} onPress={nextStep} /> : <ActionButton label="Submit for Review" onPress={() => { void submitLocally(); }} />}
            </View>
            {draft.currentStep > 1 ? <View style={styles.footerBottom}>
              <ActionButton label="Save as Draft" kind="quiet" onPress={() => { void saveAndExit(); }} />
              {draft.currentStep === 5 ? <ActionButton label="Preview Campaign" kind="secondary" onPress={() => setPreviewOpen((open) => !open)} /> : null}
            </View> : null}
            {draft.currentStep === 1 ? <Text style={styles.helper}>Save a draft to this device or continue to Step 2.</Text> : null}
          </View>
        </>}
      </View>
    </ScrollView>
  </SafeAreaView>;
}

function EntryScreen({ hasDraft, draft, notice, onManual, onVoice, onResume, onViewDraft, onNewDraft }: {
  hasDraft: boolean; draft: LocalCampaignDraft; notice: string; onManual: () => void; onVoice: () => void; onResume: () => void; onViewDraft: () => void; onNewDraft: () => void;
}) {
  return <View style={styles.entry}>
    <Text style={styles.entryEyebrow}>MAKE YOUR MESSAGE TRAVEL</Text>
    <Text style={styles.entryTitle}>Start a campaign</Text>
    <Text style={styles.body}>Build a clear story, choose who should see it, and prepare it for review.</Text>
    <View style={styles.entryOptions}>
      <ActionButton label="Create Manually" onPress={onManual} />
      <ActionButton label="Create with Your Voice" kind="secondary" onPress={onVoice} />
    </View>
    <Text style={styles.helper}>Voice recognition and AI writing are not connected. The voice option opens the same editable draft so you can type or paste your content.</Text>
    {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    {hasDraft ? <View style={styles.resumeBox}>
      <Text style={styles.sectionEyebrow}>SAVED ON THIS DEVICE</Text>
      <Text style={styles.resumeTitle}>{draft.title || 'Untitled campaign draft'}</Text>
      <Text style={styles.helper}>Last step opened: {draft.currentStep} of 5</Text>
      <View style={styles.entryOptions}><ActionButton label="Resume Draft" onPress={onResume} /><ActionButton label="View Saved Campaign" kind="secondary" onPress={onViewDraft} /><ActionButton label="Start a New Draft" kind="quiet" onPress={onNewDraft} /></View>
    </View> : null}
  </View>;
}

function StepBasics({ draft, patchDraft }: { draft: LocalCampaignDraft; patchDraft: (patch: Partial<LocalCampaignDraft>) => void }) {
  return <StepPanel title="Campaign basics" intro="Start with the information people need to understand who you are and what you want to share.">
    <Field label="Campaign title *" value={draft.title} onChangeText={(title) => patchDraft({ title })} placeholder="A clear, memorable title" maxLength={60} helper="Your title can also be used as the ad headline if you do not add a custom one later." />
    <Text style={styles.fieldLabel}>Category *</Text>
    <View style={styles.choiceWrap}>{CATEGORIES.map((category) => <Choice key={category} label={category} selected={draft.category === category} onPress={() => patchDraft({ category })} />)}</View>
    <Field label="Creator or organization name *" value={draft.creatorName} onChangeText={(creatorName) => patchDraft({ creatorName })} placeholder="Who is leading this campaign?" />
    <Field label="Short summary" value={draft.summary} onChangeText={(summary) => patchDraft({ summary })} placeholder="Describe the campaign in a few sentences" multiline maxLength={500} />
    <Field label="Cover image reference (optional)" value={draft.coverUri} onChangeText={(coverUri) => patchDraft({ coverUri })} placeholder="https://…/image.jpg or local URI" helper="Draft metadata only. This screen does not upload files. Supported references end in JPG, PNG, or WebP." error={draft.coverUri && !validImageReference(draft.coverUri) ? 'Use a JPG, PNG, or WebP image reference.' : undefined} />
    {draft.coverUri ? <Field label="Cover image alt text" value={draft.coverAlt} onChangeText={(coverAlt) => patchDraft({ coverAlt })} placeholder="Briefly describe the image" maxLength={500} /> : null}
    <Text style={styles.unavailable}>AI title and summary suggestions are unavailable until an AI service is configured.</Text>
  </StepPanel>;
}

function StepStory({ draft, patchDraft, updateSection, updateSource }: {
  draft: LocalCampaignDraft; patchDraft: (patch: Partial<LocalCampaignDraft>) => void; updateSection: (id: string, patch: Partial<LocalStorySection>) => void; updateSource: (id: string, patch: Partial<LocalSource>) => void;
}) {
  function moveSection(index: number, offset: number) {
    const target = index + offset;
    if (target < 0 || target >= draft.sections.length) return;
    const next = [...draft.sections];
    [next[index], next[target]] = [next[target], next[index]];
    patchDraft({ sections: next });
  }
  return <StepPanel title="Tell the story" intro="Write in plain text and build your story in the order you want it read.">
    <Field label="Story headline *" value={draft.storyHeadline} onChangeText={(storyHeadline) => patchDraft({ storyHeadline })} placeholder="The main idea of your story" maxLength={100} />
    <Field label="Introduction *" value={draft.introduction} onChangeText={(introduction) => patchDraft({ introduction })} placeholder="Introduce the people, need, and purpose" multiline maxLength={2500} />
    <View style={styles.sectionHeadingRow}><Text style={styles.fieldLabel}>Story sections</Text><ActionButton label="Add section" kind="secondary" onPress={() => patchDraft({ sections: [...draft.sections, { id: `section-${Date.now()}`, heading: '', body: '' }] })} /></View>
    {draft.sections.length === 0 ? <Text style={styles.helper}>Add at least one section to explain the campaign in more detail. Sections can be reordered below.</Text> : null}
    {draft.sections.map((section, index) => <View key={section.id} style={styles.editorBlock}>
      <View style={styles.sectionHeadingRow}><Text style={styles.sectionEyebrow}>SECTION {index + 1}</Text><View style={styles.inlineActions}>
        <SmallAction label="↑" accessibilityLabel="Move section up" disabled={index === 0} onPress={() => moveSection(index, -1)} />
        <SmallAction label="↓" accessibilityLabel="Move section down" disabled={index === draft.sections.length - 1} onPress={() => moveSection(index, 1)} />
        <SmallAction label="Remove" onPress={() => patchDraft({ sections: draft.sections.filter((item) => item.id !== section.id) })} />
      </View></View>
      <Field label="Section heading" value={section.heading} onChangeText={(heading) => updateSection(section.id, { heading })} placeholder="A short section title" maxLength={120} />
      <Field label="Section text" value={section.body} onChangeText={(body) => updateSection(section.id, { body })} placeholder="Write this part of the story" multiline maxLength={5000} />
    </View>)}
    <View style={styles.sectionHeadingRow}><Text style={styles.fieldLabel}>Supporting sources</Text><ActionButton label="Add source" kind="secondary" onPress={() => patchDraft({ sources: [...draft.sources, { id: `source-${Date.now()}`, title: '', url: '' }] })} /></View>
    {draft.sources.length === 0 ? <Text style={styles.helper}>Sources are optional. Include a title and a complete HTTP or HTTPS URL for each source.</Text> : null}
    {draft.sources.map((source, index) => <View key={source.id} style={styles.editorBlock}>
      <View style={styles.sectionHeadingRow}><Text style={styles.sectionEyebrow}>SOURCE {index + 1}</Text><SmallAction label="Remove" onPress={() => patchDraft({ sources: draft.sources.filter((item) => item.id !== source.id) })} /></View>
      <Field label="Source title" value={source.title} onChangeText={(title) => updateSource(source.id, { title })} placeholder="Report, article, or document title" maxLength={240} />
      <Field label="Source URL" value={source.url} onChangeText={(url) => updateSource(source.id, { url })} placeholder="https://example.org/source" keyboardType="url" error={source.url && !validHttpUrl(source.url) ? 'Enter a valid HTTP or HTTPS URL.' : undefined} />
    </View>)}
    <Field label="Suggested audience actions" value={draft.audienceActions} onChangeText={(audienceActions) => patchDraft({ audienceActions })} placeholder="What could a reader do next? (e.g. attend, learn, share)" multiline maxLength={1000} />
    <StoryPreview draft={draft} />
    <Text style={styles.unavailable}>This editor supports headings and plain text only. Rich text formatting and inline image uploads are not available yet.</Text>
  </StepPanel>;
}

function StepVisuals({ draft, patchDraft }: { draft: LocalCampaignDraft; patchDraft: (patch: Partial<LocalCampaignDraft>) => void }) {
  return <StepPanel title="Campaign and ad visuals" intro="Your campaign story is separate from the short creative shown in a planned ad.">
    <View style={styles.subsection}><Text style={styles.subsectionTitle}>Cover image metadata</Text>
      <Text style={styles.helper}>{draft.coverUri ? 'A reference is saved locally; it has not been uploaded.' : 'No cover image reference is set. This is optional.'}</Text>
      {draft.coverUri ? <Text style={styles.bodySmall}>Image: {draft.coverUri}{draft.coverAlt ? ` · ${draft.coverAlt}` : ''}</Text> : null}
    </View>
    <Field label="Ad headline" value={draft.adHeadline} onChangeText={(adHeadline) => patchDraft({ adHeadline })} placeholder={draft.title || 'A concise message for the ad'} maxLength={80} helper="Optional custom headline. If left blank, the campaign title is used as the ad headline." />
    <Field label="Ad description *" value={draft.adDescription} onChangeText={(adDescription) => patchDraft({ adDescription })} placeholder="Short supporting copy for the ad" multiline maxLength={300} />
    <Text style={styles.fieldLabel}>Call to action *</Text>
    <View style={styles.choiceWrap}>{['Learn more', 'Sign up', 'Get involved', 'Visit website'].map((cta) => <Choice key={cta} label={cta} selected={draft.callToAction === cta} onPress={() => patchDraft({ callToAction: cta })} />)}</View>
    <Field label="Ad image reference (optional)" value={draft.adImageUri} onChangeText={(adImageUri) => patchDraft({ adImageUri })} placeholder="https://…/creative.png or local URI" helper="Draft-only reference; uploading through Supabase Storage is not enabled in this phase." error={draft.adImageUri && !validImageReference(draft.adImageUri) ? 'Use a JPG, PNG, or WebP image reference.' : undefined} />
    {draft.adImageUri ? <>
      <Field label="Ad image alt text" value={draft.adImageAlt} onChangeText={(adImageAlt) => patchDraft({ adImageAlt })} placeholder="Describe the creative for accessibility" maxLength={500} />
      <Field label="Image metadata (optional)" value={draft.adImageMetadata} onChangeText={(adImageMetadata) => patchDraft({ adImageMetadata })} placeholder="e.g. 1200 × 628; file size if known" />
    </> : null}
    <AdPreview draft={draft} />
    <Text style={styles.unavailable}>A preview is text-only unless an image reference is provided. File bytes, dimensions, and upload status are not verified here.</Text>
  </StepPanel>;
}

function StepReach({ draft, patchDraft, allocated, estimatedReach }: { draft: LocalCampaignDraft; patchDraft: (patch: Partial<LocalCampaignDraft>) => void; allocated: number; estimatedReach: number }) {
  return <StepPanel title="Audience and reach" intro="Choose an initial plan. SIGNAL may adjust settings during review; no ads are being purchased or delivered here.">
    <Text style={styles.fieldLabel}>Target locations *</Text>
    <Text style={styles.helper}>Select from the demo location list. Additional location search is not connected yet.</Text>
    <View style={styles.choiceWrap}>{LOCATIONS.map((location) => <Choice key={location} label={location} selected={draft.locations.includes(location)} onPress={() => patchDraft({ locations: toggleItem(draft.locations, location) })} />)}</View>
    <View style={styles.twoColumns}><Field label="Minimum age" value={draft.minimumAge} onChangeText={(minimumAge) => patchDraft({ minimumAge })} placeholder="18" keyboardType="numeric" /><Field label="Maximum age" value={draft.maximumAge} onChangeText={(maximumAge) => patchDraft({ maximumAge })} placeholder="Optional" keyboardType="numeric" /></View>
    <Field label="Audience interests" value={draft.interests} onChangeText={(interests) => patchDraft({ interests })} placeholder="Separate interests with commas" helper="Interests are creator-selected suggestions for later review." />
    <Text style={styles.fieldLabel}>Planned distribution channels *</Text>
    <View style={styles.choiceWrap}>{CHANNELS.map((channel) => <Choice key={channel.id} label={channel.label} selected={draft.channels.includes(channel.id)} onPress={() => patchDraft({ channels: toggleItem(draft.channels, channel.id) })} />)}</View>
    <Text style={styles.fieldLabel}>Campaign duration *</Text>
    <View style={styles.choiceWrap}>{['7', '14', '30'].map((days) => <Choice key={days} label={`${days} days`} selected={draft.durationDays === days} onPress={() => patchDraft({ durationDays: days })} />)}</View>
    <Field label="Custom duration in days" value={draft.durationDays} onChangeText={(durationDays) => patchDraft({ durationDays })} keyboardType="numeric" helper="Use 1–90 days. This is a proposed duration for review." />
    <Text style={styles.fieldLabel}>Budget allocation (USD)</Text>
    <View style={styles.twoColumns}><Field label="Instagram allocation ($)" value={draft.instagramBudget} onChangeText={(instagramBudget) => patchDraft({ instagramBudget })} placeholder="0" keyboardType="decimal-pad" /><Field label="Facebook allocation ($)" value={draft.facebookBudget} onChangeText={(facebookBudget) => patchDraft({ facebookBudget })} placeholder="0" keyboardType="decimal-pad" /></View>
    <View style={styles.summaryBox}>
      <Text style={styles.summaryTitle}>Your selected settings</Text>
      <Text style={styles.bodySmall}>Locations: {draft.locations.join(', ') || 'Not selected'}</Text>
      <Text style={styles.bodySmall}>Channels: {draft.channels.map((channel) => CHANNELS.find((item) => item.id === channel)?.label).join(', ') || 'Not selected'}</Text>
      <Text style={styles.bodySmall}>Duration: {draft.durationDays || 'Not set'} days · Allocated budget: ${allocated.toLocaleString()} USD</Text>
      <Text style={styles.estimate}>Illustrative reach estimate: ~{estimatedReach.toLocaleString()} potential views</Text>
      <Text style={styles.helper}>Configurable demo assumption: {DEMO_REACH_PER_DOLLAR} potential views per $1 allocated. This is not platform data, a guaranteed audience, or funding progress. Actual reach may vary and is not guaranteed.</Text>
    </View>
    <Text style={styles.unavailable}>Audience targeting and final channel placement are subject to platform review; these settings have not been sent to an ad platform.</Text>
  </StepPanel>;
}

function StepReview({ draft, patchDraft, allocated, estimatedReach, previewOpen, setPreviewOpen }: {
  draft: LocalCampaignDraft; patchDraft: (patch: Partial<LocalCampaignDraft>) => void; allocated: number; estimatedReach: number; previewOpen: boolean; setPreviewOpen: (value: boolean | ((current: boolean) => boolean)) => void;
}) {
  return <StepPanel title="Review and submit" intro="Check every section, set the funding goal yourself, then confirm the submission rules.">
    <Field label="Creator-set funding goal (USD) *" value={draft.fundingGoal} onChangeText={(fundingGoal) => patchDraft({ fundingGoal })} placeholder="Enter the amount you are requesting" keyboardType="decimal-pad" helper="This is your campaign funding goal. It is separate from estimated audience reach and will not be auto-filled." />
    <View style={styles.reviewSection}><Text style={styles.subsectionTitle}>Basics</Text><Text style={styles.reviewText}>{draft.title || 'Untitled'} · {draft.category || 'No category'}</Text><Text style={styles.reviewText}>Created by {draft.creatorName || 'Not set'}</Text><Text style={styles.reviewText}>{draft.summary || 'No short summary'}</Text><Text style={styles.reviewText}>Cover reference: {draft.coverUri ? 'saved locally; not uploaded' : 'none'}</Text></View>
    <View style={styles.reviewSection}><Text style={styles.subsectionTitle}>Story and sources</Text><Text style={styles.reviewText}>{draft.storyHeadline || 'No story headline'}</Text><Text style={styles.reviewText}>{draft.introduction || 'No introduction'}</Text>{draft.sections.map((section, index) => <Text key={section.id} style={styles.reviewText}>{index + 1}. {section.heading || 'Untitled section'} — {section.body || 'No text'}</Text>)}{draft.sources.map((source) => <Text key={source.id} style={styles.reviewText}>{source.title || 'Untitled source'} · {source.url || 'No URL'}</Text>)}<Text style={styles.reviewText}>Suggested actions: {draft.audienceActions || 'None'}</Text></View>
    <View style={styles.reviewSection}><Text style={styles.subsectionTitle}>Ad creative</Text><Text style={styles.reviewText}>{draft.adHeadline || draft.title || 'No headline'} · {draft.adDescription || 'No description'}</Text><Text style={styles.reviewText}>CTA: {draft.callToAction}</Text><Text style={styles.reviewText}>Ad image: {draft.adImageUri ? 'reference saved locally; not uploaded' : 'none'}</Text></View>
    <View style={styles.reviewSection}><Text style={styles.subsectionTitle}>Audience, plan, and funding</Text><Text style={styles.reviewText}>Locations: {draft.locations.join(', ') || 'None'}</Text><Text style={styles.reviewText}>Ages: {draft.minimumAge || 'Not set'}–{draft.maximumAge || 'No maximum'} · Interests: {draft.interests || 'None'}</Text><Text style={styles.reviewText}>Channels: {draft.channels.join(', ') || 'None'} · Duration: {draft.durationDays} days</Text><Text style={styles.reviewText}>Budget allocations: ${allocated.toLocaleString()} USD · Funding goal: {draft.fundingGoal ? `$${money(draft.fundingGoal).toLocaleString()} USD` : 'Not set'}</Text><Text style={styles.estimate}>Illustrative reach: ~{estimatedReach.toLocaleString()} potential views</Text><Text style={styles.helper}>Uses the configurable demo assumption of {DEMO_REACH_PER_DOLLAR} potential views per $1 allocated; not verified or guaranteed.</Text></View>
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: draft.policyAccepted }} onPress={() => patchDraft({ policyAccepted: !draft.policyAccepted })} style={styles.policyRow}>
      <View style={[styles.checkbox, draft.policyAccepted && styles.checkboxChecked]}>{draft.policyAccepted ? <Text style={styles.checkMark}>✓</Text> : null}</View>
      <Text style={styles.policyText}>I confirm this campaign information is accurate to the best of my knowledge, I have permission to use its content and referenced assets, and I agree to submit it for review. A device copy is saved; if the SIGNAL API is configured, submission is also sent to that API.</Text>
    </Pressable>
    {previewOpen ? <View style={styles.previewPanel}><Text style={styles.sectionEyebrow}>CAMPAIGN PREVIEW</Text><Text style={styles.previewTitle}>{draft.title || 'Campaign title'}</Text><Text style={styles.reviewText}>By {draft.creatorName || 'Creator'} · {draft.category || 'Category'}</Text><StoryPreview draft={draft} /><AdPreview draft={draft} /></View> : null}
  </StepPanel>;
}

function StepPanel({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return <View style={styles.panel}><Text style={styles.stepTitle}>{title}</Text><Text style={styles.stepIntro}>{intro}</Text>{children}</View>;
}

function StoryPreview({ draft }: { draft: LocalCampaignDraft }) {
  return <View style={styles.previewPanel}><Text style={styles.sectionEyebrow}>STORY PREVIEW</Text><Text style={styles.previewTitle}>{draft.storyHeadline || 'Your story headline'}</Text><Text style={styles.reviewText}>{draft.introduction || 'Your introduction will appear here.'}</Text>{draft.sections.map((section) => <View key={section.id} style={styles.previewSection}><Text style={styles.previewSectionTitle}>{section.heading || 'Section heading'}</Text><Text style={styles.reviewText}>{section.body || 'Section text will appear here.'}</Text></View>)}{draft.sources.length ? <Text style={styles.helper}>Sources: {draft.sources.map((source) => source.title || source.url).join(' · ')}</Text> : null}</View>;
}

function AdPreview({ draft }: { draft: LocalCampaignDraft }) {
  return <View style={styles.adPreview}><Text style={styles.sectionEyebrow}>AD PREVIEW · DRAFT ONLY</Text><Text style={styles.adTitle}>{draft.adHeadline || draft.title || 'Ad headline'}</Text><Text style={styles.reviewText}>{draft.adDescription || 'Ad description will appear here.'}</Text><Text style={styles.adCta}>{draft.callToAction}</Text>{draft.adImageUri ? <Text style={styles.helper}>Image reference saved locally; not uploaded: {draft.adImageUri}</Text> : <Text style={styles.helper}>No ad image selected.</Text>}</View>;
}

function LocalConfirmation({ draft, syncMessage, canRetry, onRetry, onNewDraft }: { draft: LocalCampaignDraft; syncMessage: string; canRetry: boolean; onRetry: () => void; onNewDraft: () => void }) {
  const backendSubmitted = draft.apiSubmissionStatus === 'submitted';
  const syncFailed = draft.apiSubmissionStatus === 'sync_failed';
  const description = backendSubmitted
    ? `“${draft.title || 'Untitled campaign'}” is saved on this device and confirmed by Supabase through the SIGNAL API. It is awaiting review; no reviewer decision or real funding is claimed.`
    : syncFailed
      ? `“${draft.title || 'Untitled campaign'}” is saved on this device, but backend submission could not be confirmed. No backend review status is claimed.`
      : `“${draft.title || 'Untitled campaign'}” has been marked as submitted on this device. It has not been sent to the SIGNAL API or Supabase, and no review has started.`;
  const status = backendSubmitted
    ? 'Supabase submission confirmed · awaiting review'
    : syncFailed
      ? 'Saved locally · backend sync failed'
      : 'Submitted locally · awaiting backend connection';
  return <View style={styles.confirmation}><Text style={styles.entryEyebrow}>{backendSubmitted ? 'SIGNAL API SUBMISSION' : 'LOCAL DRAFT SUBMISSION'}</Text><Text style={styles.entryTitle}>{backendSubmitted ? 'Submission received' : 'Saved for your review'}</Text><Text style={styles.body}>{description}</Text><View style={styles.statusBox}><Text style={styles.sectionEyebrow}>STATUS</Text><Text style={styles.statusText}>{status}</Text></View>{syncMessage ? <Text style={styles.body}>{syncMessage}</Text> : null}{canRetry && !backendSubmitted ? <ActionButton label="Retry backend sync" kind="secondary" onPress={onRetry} /> : null}<ActionButton label="View Campaign" onPress={() => router.push({ pathname: '/campaign/[id]', params: { id: `${backendSubmitted ? 'api' : 'local'}-${draft.id}` } } as never)} /><ActionButton label="Start another campaign" kind="secondary" onPress={onNewDraft} /></View>;
}

function SmallAction({ label, accessibilityLabel, disabled, onPress }: { label: string; accessibilityLabel?: string; disabled?: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} disabled={disabled} onPress={onPress} style={[styles.smallAction, disabled && styles.disabled]}><Text style={styles.smallActionText}>{label}</Text></Pressable>;
}

function toggleItem<T extends string>(values: T[], item: T): T[] {
  return values.includes(item) ? values.filter((value) => value !== item) : [...values, item];
}

function validateStep(step: number, draft: LocalCampaignDraft): string[] {
  const errors: string[] = [];
  if (step === 1) {
    if (!draft.title.trim()) errors.push('Add a campaign title.');
    if (draft.title.trim().length > 60) errors.push('Keep the campaign title to 60 characters or fewer.');
    if (!draft.category) errors.push('Choose a campaign category.');
    if (!draft.creatorName.trim()) errors.push('Add a creator or organization name.');
    if (!validImageReference(draft.coverUri)) errors.push('Use a JPG, PNG, or WebP cover reference.');
  }
  if (step === 2) {
    if (!draft.storyHeadline.trim()) errors.push('Add a story headline.');
    if (!draft.introduction.trim()) errors.push('Add a story introduction.');
    if (!draft.sections.length || !draft.sections.some((section) => section.body.trim())) errors.push('Add at least one story section with text.');
    if (draft.sources.some((source) => !source.title.trim() || !validHttpUrl(source.url))) errors.push('Complete every source title and enter a valid HTTP or HTTPS URL.');
  }
  if (step === 3) {
    if (!draft.adHeadline.trim() && !draft.title.trim()) errors.push('Add an ad headline or a campaign title to use as the fallback.');
    if (!draft.adDescription.trim()) errors.push('Add an ad description.');
    if (!draft.callToAction.trim()) errors.push('Choose a call to action.');
    if (!validImageReference(draft.adImageUri)) errors.push('Use a JPG, PNG, or WebP ad image reference.');
  }
  if (step === 4) {
    if (!draft.locations.length) errors.push('Select at least one target location.');
    if (!draft.channels.length) errors.push('Select at least one distribution channel.');
    const duration = Number(draft.durationDays);
    if (!Number.isInteger(duration) || duration < 1 || duration > 90) errors.push('Set a campaign duration from 1 to 90 days.');
    if (draft.minimumAge && (!Number.isInteger(Number(draft.minimumAge)) || Number(draft.minimumAge) < 18 || Number(draft.minimumAge) > 100)) errors.push('Set a minimum age from 18 to 100.');
    if (draft.maximumAge && (!Number.isInteger(Number(draft.maximumAge)) || Number(draft.maximumAge) < 18 || Number(draft.maximumAge) > 100)) errors.push('Set a maximum age from 18 to 100.');
    if (draft.minimumAge && draft.maximumAge && Number(draft.maximumAge) < Number(draft.minimumAge)) errors.push('Maximum age must be at least the minimum age.');
    if ([draft.instagramBudget, draft.facebookBudget].some((value) => value !== '' && (!/^\d+(\.\d{1,2})?$/.test(value) || !Number.isSafeInteger(Math.round(Number(value) * 100))))) errors.push('Enter non-negative channel allocations in USD, with up to two decimal places.');
    if (!draft.channels.includes('instagram') && money(draft.instagramBudget) > 0 || !draft.channels.includes('facebook') && money(draft.facebookBudget) > 0) errors.push('Select each channel that has a budget allocation.');
  }
  if (step === 5) {
    if (!draft.fundingGoal || !/^\d+(\.\d{1,2})?$/.test(draft.fundingGoal) || !Number.isSafeInteger(Math.round(Number(draft.fundingGoal) * 100)) || money(draft.fundingGoal) <= 0) errors.push('Enter a funding goal greater than $0 USD, with up to two decimal places.');
    if (allocatedTotal(draft) > money(draft.fundingGoal)) errors.push('Channel allocations cannot exceed the funding goal.');
    if (allocatedTotal(draft) <= 0) errors.push('Add a positive budget allocation to at least one selected channel.');
    if (!draft.policyAccepted) errors.push('Confirm the submission rules before submitting.');
  }
  return errors;
}

function allocatedTotal(draft: LocalCampaignDraft): number {
  return money(draft.instagramBudget) + money(draft.facebookBudget);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  scrollContent: { flexGrow: 1, paddingHorizontal: Spacing.three, paddingTop: Spacing.three, paddingBottom: 120, alignItems: 'center' },
  page: { width: '100%', maxWidth: MaxContentWidth },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wordmark: { color: C.text, fontSize: 13, fontWeight: '800', letterSpacing: 3, marginBottom: Spacing.four },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  pageTitle: { color: C.text, fontSize: 28, lineHeight: 34, fontWeight: '700' },
  stepCount: { color: C.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  progressTrack: { flexDirection: 'row', gap: 5, marginTop: Spacing.three },
  progressSegment: { flex: 1, height: 5, borderRadius: 4, backgroundColor: C.line },
  progressSegmentActive: { backgroundColor: C.green },
  stepLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7, marginBottom: Spacing.three },
  stepLabel: { color: C.muted, fontSize: 10 },
  stepLabelCurrent: { color: C.text, fontWeight: '700' },
  notice: { color: C.text, backgroundColor: C.surface, borderRadius: 10, padding: 12, fontSize: 13, lineHeight: 19, marginVertical: 10 },
  saveNotice: { color: C.text, fontSize: 12, marginBottom: 10 },
  errorBox: { borderWidth: 1, borderColor: '#B98291', borderRadius: 10, padding: 12, marginBottom: 12 },
  errorTitle: { color: C.text, fontWeight: '700', fontSize: 13, marginBottom: 4 },
  errorText: { color: '#8F3F4E', fontSize: 12, lineHeight: 18, marginTop: 3 },
  panel: { backgroundColor: C.surface, borderRadius: 15, padding: 18, gap: 16 },
  stepTitle: { color: C.text, fontSize: 23, lineHeight: 29, fontWeight: '700' },
  stepIntro: { color: C.muted, fontSize: 14, lineHeight: 21, marginTop: -10 },
  field: { flex: 1, minWidth: 0, gap: 6 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  fieldLabel: { color: C.text, fontSize: 13, lineHeight: 19, fontWeight: '700', marginBottom: 7 },
  counter: { color: C.muted, fontSize: 11 },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 11, minHeight: 44, backgroundColor: C.paper, color: C.text, fontSize: 14, lineHeight: 20 },
  inputError: { borderColor: '#8F3F4E' },
  multiline: { minHeight: 100, paddingTop: 12 },
  helper: { color: C.muted, fontSize: 11, lineHeight: 16 },
  body: { color: C.muted, fontSize: 15, lineHeight: 23 },
  bodySmall: { color: C.muted, fontSize: 12, lineHeight: 19 },
  choiceWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -6 },
  choice: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper },
  choiceSelected: { backgroundColor: C.green, borderColor: C.green },
  choiceText: { color: C.text, fontSize: 12, fontWeight: '600' },
  choiceTextSelected: { color: '#FFFFFF' },
  unavailable: { color: C.muted, fontSize: 11, lineHeight: 17, borderLeftWidth: 2, borderLeftColor: C.brown, paddingLeft: 10 },
  sectionHeadingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  inlineActions: { flexDirection: 'row', gap: 5 },
  editorBlock: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 13, gap: 11 },
  sectionEyebrow: { color: C.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  smallAction: { minHeight: 30, minWidth: 34, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, borderRadius: 15, borderWidth: 1, borderColor: C.line },
  smallActionText: { color: C.text, fontSize: 11, fontWeight: '600' },
  previewPanel: { backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, borderRadius: 11, padding: 14, gap: 9 },
  previewTitle: { color: C.text, fontSize: 19, lineHeight: 25, fontWeight: '700' },
  previewSection: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8, gap: 4 },
  previewSectionTitle: { color: C.text, fontSize: 14, fontWeight: '700' },
  subsection: { padding: 13, borderRadius: 10, backgroundColor: C.paper, gap: 7 },
  subsectionTitle: { color: C.text, fontSize: 14, fontWeight: '700' },
  adPreview: { borderWidth: 1, borderColor: C.line, borderRadius: 11, padding: 14, gap: 8, backgroundColor: C.paper },
  adTitle: { color: C.text, fontSize: 17, lineHeight: 23, fontWeight: '700' },
  adCta: { alignSelf: 'flex-start', backgroundColor: C.green, color: '#FFFFFF', fontSize: 12, fontWeight: '700', paddingHorizontal: 13, paddingVertical: 8, overflow: 'hidden', borderRadius: 18 },
  twoColumns: { flexDirection: 'row', gap: 12 },
  summaryBox: { borderWidth: 1, borderColor: C.line, borderRadius: 11, padding: 14, gap: 7 },
  summaryTitle: { color: C.text, fontSize: 14, fontWeight: '700' },
  estimate: { color: C.text, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  reviewSection: { borderTopWidth: 1, borderTopColor: C.line, paddingTop: 12, gap: 6 },
  reviewText: { color: C.muted, fontSize: 12, lineHeight: 18 },
  policyRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', padding: 12, backgroundColor: C.paper, borderRadius: 10 },
  checkbox: { width: 22, height: 22, borderWidth: 1, borderColor: C.line, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: C.green, borderColor: C.green },
  checkMark: { color: '#FFFFFF', fontWeight: '800' },
  policyText: { flex: 1, color: C.text, fontSize: 12, lineHeight: 18 },
  footerActions: { gap: 8, marginTop: Spacing.three },
  footerTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  footerBottom: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  actionButton: { minHeight: 46, minWidth: 110, paddingHorizontal: 17, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  action_primary: { backgroundColor: C.green },
  action_secondary: { borderWidth: 1, borderColor: C.line, backgroundColor: C.paper },
  action_quiet: { backgroundColor: 'transparent' },
  actionText: { color: '#FFFFFF', fontSize: 13, lineHeight: 18, fontWeight: '700', textAlign: 'center' },
  actionTextSecondary: { color: C.text },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
  entry: { gap: 16, paddingTop: 12 },
  entryEyebrow: { color: C.brown, fontSize: 11, letterSpacing: 1.8, fontWeight: '800' },
  entryTitle: { color: C.text, fontSize: 34, lineHeight: 40, fontWeight: '700' },
  entryOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  resumeBox: { backgroundColor: C.surface, borderRadius: 13, padding: 16, gap: 9, marginTop: 10 },
  resumeTitle: { color: C.text, fontSize: 18, fontWeight: '700' },
  confirmation: { gap: 18, paddingTop: 18 },
  statusBox: { borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 14, gap: 8 },
  statusText: { color: C.text, fontSize: 14, lineHeight: 20, fontWeight: '700' },
});
