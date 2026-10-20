import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Palette as C } from '@/constants/theme';
import { discoveryCampaigns, formatIsoDate, getDeadlineLabel, isDeadlineExpired } from '@/data/campaigns';
import { readLocalCampaign } from '@/data/campaign-draft-storage';
import { getCampaignFromApi, listDemoContributionsFromApi } from '@/data/signal-api';
import { readCampaignDemoContributions, readDemoContributions } from '@/data/demo-contributions';
import { campaignFundingMinorForContribution, DEMO_REACH_PER_RUPEE } from '@/data/demo-reach';
import { calculateFundingProgress, formatInrMinor, formatUsdMinor, parseUsdMinor } from '@/data/funding';
import { campaignStories, campaignStoryFinalHeading } from '@/data/campaign-story-content';
import { useAuth } from '@/auth/auth-context';
import { DEMO_REACH_PER_DOLLAR, type LocalCampaignDraft, type LocalDemoContribution } from '@/types/local-campaign';
import { useUtcToday } from '@/hooks/use-utc-today';

function CampaignShareAction({ campaignId, title }: { campaignId: string; title: string }) {
  const [webDialogOpen, setWebDialogOpen] = useState(false);
  const [copyMessage, setCopyMessage] = useState('');
  const [shareError, setShareError] = useState('');

  const share = async () => {
    const url = Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.href
      : `campaignamplification:///campaign/${encodeURIComponent(campaignId)}`;
    setCopyMessage('');
    setShareError('');
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        try {
          await navigator.share({ title, text: `Campaign on SIGNAL: ${title}`, url });
          return;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return;
        }
      }
      setWebDialogOpen(true);
      return;
    }

    try {
      await Share.share({ title, message: `${title}\n${url}`, url });
    } catch {
      setShareError('The share sheet could not be opened. No share was sent.');
    }
  };

  const copyCampaignLink = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    try {
      if (!url || !navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url);
      setCopyMessage('Link copied to clipboard.');
    } catch {
      setCopyMessage('Clipboard access is unavailable. Select and copy the link below.');
    }
  };

  return <View style={styles.shareWrap}>
    <Pressable accessibilityRole="button" onPress={() => { void share(); }} style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}>
      <Text style={styles.shareButtonText}>Share</Text>
    </Pressable>
    {shareError ? <Text accessibilityLiveRegion="polite" style={styles.shareMessage}>{shareError}</Text> : null}
    <Modal visible={webDialogOpen} transparent animationType="fade" onRequestClose={() => setWebDialogOpen(false)}>
      <View style={styles.shareModalBackdrop}>
        <View accessibilityViewIsModal style={styles.shareModal}>
          <Text accessibilityRole="header" style={styles.shareModalTitle}>Share this campaign</Text>
          <Text style={styles.shareModalCopy}>{title}</Text>
          <Text selectable style={styles.shareModalUrl}>{typeof window !== 'undefined' ? window.location.href : ''}</Text>
          {copyMessage ? <Text accessibilityLiveRegion="polite" style={styles.shareModalStatus}>{copyMessage}</Text> : null}
          <View style={styles.shareModalActions}>
            <Pressable accessibilityRole="button" onPress={() => { void copyCampaignLink(); }} style={({ pressed }) => [styles.shareButton, pressed && styles.pressed]}>
              <Text style={styles.shareButtonText}>Copy Link</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setWebDialogOpen(false)} style={({ pressed }) => [styles.shareCancelButton, pressed && styles.pressed]}>
              <Text style={styles.shareCancelText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  </View>;
}

function Accordion({ title, children }: { title: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return <View style={styles.accordion}>
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      onPress={() => setExpanded((value) => !value)}
      style={({ pressed }) => [styles.accordionHeader, pressed && styles.pressed]}>
      <Text style={styles.accordionTitle}>{title}</Text>
      <Text style={styles.accordionChevron}>{expanded ? '−' : '+'}</Text>
    </Pressable>
    {expanded ? <View style={styles.accordionBody}>{children}</View> : null}
  </View>;
}

function StoryAndSources({ campaign }: { campaign: (typeof discoveryCampaigns)[number] }) {
  const story = campaignStories[campaign.id];
  return <View style={styles.storySection}>
    <Text accessibilityRole="header" style={styles.storyTitle}>The Story Behind the Campaign</Text>
    <Text style={styles.storyDisclosure}>{story?.disclosure ?? 'Illustrative demo campaign. Details and outcomes have not been independently verified.'}</Text>
    {(story?.sections ?? [{ heading: '', paragraphs: [campaign.description] }]).map((section, sectionIndex) => <View key={`${section.heading}-${sectionIndex}`} style={styles.storyBlock}>
      {section.heading === campaignStoryFinalHeading ? <Text accessibilityRole="header" style={styles.storySubheading}>{campaignStoryFinalHeading}</Text> : null}
      {section.paragraphs.map((paragraph, paragraphIndex) => <View key={`${sectionIndex}-${paragraphIndex}`} style={styles.storyParagraphGroup}>
        <Text style={styles.storyCopy}>{paragraph}</Text>
        {section.photos?.[paragraphIndex] ? <StoryPhoto source={section.photos[paragraphIndex]!.source} caption={section.photos[paragraphIndex]!.caption} /> : null}
      </View>)}
    </View>)}
  </View>;
}

function StoryPhoto({ source, caption }: { source: number; caption: string }) {
  return <View style={styles.storyPhotoBlock}>
    <Image source={source} style={styles.storyPhoto} contentFit="cover" accessibilityLabel={caption} />
    <Text style={styles.storyCaption}>{caption}</Text>
  </View>;
}

type FeedbackChoice = 'No' | 'Somewhat' | 'Yes';

function CampaignFeedback() {
  const [visualsAnswer, setVisualsAnswer] = useState<FeedbackChoice | null>(null);
  const [messageAnswer, setMessageAnswer] = useState<FeedbackChoice | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const updateVisualsAnswer = (answer: FeedbackChoice) => {
    if (answer !== visualsAnswer) setSubmitted(false);
    setVisualsAnswer(answer);
  };
  const updateMessageAnswer = (answer: FeedbackChoice) => {
    if (answer !== messageAnswer) setSubmitted(false);
    setMessageAnswer(answer);
  };

  return <View style={styles.feedbackSection}>
    <Text accessibilityRole="header" style={styles.feedbackTitle}>We&apos;d Love Your Thoughts</Text>
    <Text style={styles.feedbackCopy}>Your feedback helps us understand how this campaign communicates its message.</Text>
    <FeedbackQuestion
      question="Did the visuals encourage you to continue reading?"
      value={visualsAnswer}
      onChange={updateVisualsAnswer}
    />
    <FeedbackQuestion
      question="Did the campaign message change your mind?"
      value={messageAnswer}
      onChange={updateMessageAnswer}
    />
    <Pressable accessibilityRole="button" onPress={() => setSubmitted(true)} style={({ pressed }) => [styles.feedbackSubmit, pressed && styles.pressed]}>
      <Text style={styles.feedbackSubmitText}>Submit Feedback</Text>
    </Pressable>
    {submitted ? <View style={styles.feedbackConfirmation}>
      <View style={styles.feedbackConfirmationHeading}>
        <View style={styles.feedbackConfirmationIcon}><Text style={styles.feedbackConfirmationCheck}>✓</Text></View>
        <Text accessibilityLiveRegion="polite" style={styles.feedbackConfirmationTitle}>Feedback submitted</Text>
      </View>
      <Text style={styles.feedbackConfirmationCopy}>This is a demo interaction. Your feedback isn&apos;t sent to or stored by SIGNAL.</Text>
    </View> : null}
  </View>;
}

function FeedbackQuestion({ question, value, onChange }: {
  question: string;
  value: FeedbackChoice | null;
  onChange: (choice: FeedbackChoice) => void;
}) {
  return <View style={styles.feedbackQuestion}>
    <Text style={styles.feedbackQuestionText}>{question}</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel={question} style={styles.feedbackOptions}>
      {(['No', 'Somewhat', 'Yes'] as const).map((choice) => {
        const selected = value === choice;
        return <Pressable
          key={choice}
          accessibilityRole="radio"
          accessibilityLabel={choice}
          accessibilityState={{ selected }}
          onPress={() => onChange(choice)}
          style={({ pressed }) => [styles.feedbackOption, selected && styles.feedbackOptionSelected, pressed && styles.pressed]}>
          <Text style={[styles.feedbackOptionText, selected && styles.feedbackOptionTextSelected]}>{choice}</Text>
        </Pressable>;
      })}
    </View>
  </View>;
}

function PolicyPoint({ title, children, infoSection }: { title: string; children: ReactNode; infoSection?: 'terms' | 'privacy' | 'partners' }) {
  return <View style={styles.policyPoint}>
    <Text style={styles.policyHeading}>{title}</Text>
    <Text style={styles.accordionCopy}>{children}</Text>
    {infoSection ? <Pressable accessibilityRole="link" onPress={() => router.push({ pathname: '/information', params: { section: infoSection } } as never)} hitSlop={6} style={styles.infoLink}><Text style={styles.infoLinkText}>{infoSection === 'terms' ? 'Terms' : infoSection === 'privacy' ? 'Privacy' : 'Partners'} →</Text></Pressable> : null}
  </View>;
}

function DemoCampaignAccordions({ campaign }: { campaign: (typeof discoveryCampaigns)[number] }) {
  return <View style={styles.accordions}>
    <Accordion title="Use of Funds">
      <View style={styles.purposeNotice}><Text style={styles.purposeText}>Contributions fund distribution of the campaign message, not direct charitable support for the cause.</Text></View>
      <PolicyPoint title="Platform fees">No platform fee or fee percentage is configured for this prototype.</PolicyPoint>
      <PolicyPoint title="Portion available for advertising">No confirmed share of funds available for advertising or distribution is specified. Any displayed allocation is a demo planning figure only.</PolicyPoint>
      <PolicyPoint title="Allocation policies">The prototype records simulated contribution entries locally and does not allocate or transfer real funds to an advertising account.</PolicyPoint>
      <PolicyPoint title="Refund conditions" infoSection="terms">No real payment is processed, so a refund policy is not configured for these demo contributions.</PolicyPoint>
      <PolicyPoint title="Treatment of unspent funds">The prototype does not specify or process a policy for unspent funds.</PolicyPoint>
    </Accordion>

    <Accordion title="Audience & Distribution">
      <PolicyPoint title="Intended audience">This record concerns {campaign.cause.toLowerCase()}. A specific audience segment is not defined in the campaign data.</PolicyPoint>
      <PolicyPoint title="Targeting choices">The demo campaign has no configured age, interest, or audience-targeting selections. The listed country ({campaign.country}) is campaign metadata, not confirmed ad targeting.</PolicyPoint>
      <PolicyPoint title="Supported placements">The campaign record lists {campaign.platform} as proposed placements. No ad account or platform integration is configured to purchase or place ads.</PolicyPoint>
      <PolicyPoint title="Distribution approach">The prototype describes message amplification as the intended use. No distribution or advertising delivery has occurred through SIGNAL.</PolicyPoint>
      <PolicyPoint title="Privacy and advertising disclosures" infoSection="privacy">This detail view does not send audience-targeting selections to an advertising platform. No personal information is disclosed to ad platforms by a delivery integration because none is configured.</PolicyPoint>
    </Accordion>

    <Accordion title="Review, Trust & Feedback">
      <PolicyPoint title="Review process">Current catalogue status: {campaign.status}. This bundled demo record has no separate reviewer decision attached; status does not imply approval.</PolicyPoint>
      <PolicyPoint title="Verification information">No independent verification, audit, endorsement, or trust score is recorded for this campaign.</PolicyPoint>
      <PolicyPoint title="Distribution partners" infoSection="partners">No confirmed distribution partners are configured or documented.</PolicyPoint>
    </Accordion>
  </View>;
}

function goBackOr(fallback: '/explore' | '/create') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as never);
}

export default function CampaignDetailsScreen() {
  const { id, owner } = useLocalSearchParams<{ id: string; owner?: string }>();
  const today = useUtcToday();
  const { user, session } = useAuth();
  const isRemoteCampaign = id?.startsWith('api-') ?? false;
  const localId = id?.startsWith('local-') || isRemoteCampaign ? id.slice(id.indexOf('-') + 1) : '';
  const [localCampaign, setLocalCampaign] = useState<LocalCampaignDraft | null>(null);
  const [loadedLocalKey, setLoadedLocalKey] = useState('');
  const [demoContributions, setDemoContributions] = useState<LocalDemoContribution[]>([]);
  const [demoContributionLoadError, setDemoContributionLoadError] = useState('');
  const localOwner = owner === 'device-draft' ? owner : (user?.id ?? 'device-draft');
  const localLoadKey = `${localId}:${localOwner}`;
  const localLoading = Boolean(localId && loadedLocalKey !== localLoadKey);
  const campaign = discoveryCampaigns.find((item) => item.id === id);

  useEffect(() => {
    let active = true;
    if (!campaign) return () => { active = false; };
    void readCampaignDemoContributions(campaign.id).then((items) => {
      if (active) {
        setDemoContributions(items);
        setDemoContributionLoadError('');
      }
    }).catch(() => {
      if (active) {
        setDemoContributions([]);
        setDemoContributionLoadError('Local demo contribution storage is unavailable. No contribution was recorded.');
      }
    });
    return () => { active = false; };
  }, [campaign]);

  useEffect(() => {
    let active = true;
    if (!localId) return () => { active = false; };
    const load = isRemoteCampaign && session?.access_token
      ? getCampaignFromApi(localId, session.access_token)
      : isRemoteCampaign
        ? Promise.resolve(null)
        : readLocalCampaign(localOwner, localId);
    void load.then((value) => {
      if (active) {
        setLocalCampaign(value);
        setLoadedLocalKey(localLoadKey);
      }
    }).catch(() => {
      if (active) {
        setLocalCampaign(null);
        setLoadedLocalKey(localLoadKey);
      }
    });
    return () => { active = false; };
  }, [isRemoteCampaign, localId, localLoadKey, localOwner, session?.access_token]);

  if (localId) {
    if (!session) return <SafeAreaView style={styles.safe}><View style={styles.notFound}>
      <Text style={styles.title}>Sign in to view this saved campaign</Text>
      <Text style={styles.copy}>Explore campaign details are public. Saved campaign details remain available to the signed-in account that created them.</Text>
      <Pressable accessibilityRole="button" onPress={() => router.replace('/login' as never)} style={styles.backButton}><Text style={styles.backButtonText}>Sign in</Text></Pressable>
    </View></SafeAreaView>;
    if (localLoading) return <SafeAreaView style={styles.safe}><View style={styles.notFound}><Text style={styles.copy}>Opening your saved campaign…</Text></View></SafeAreaView>;
    if (!localCampaign) return <SafeAreaView style={styles.safe}><View style={styles.notFound}>
      <Text style={styles.title}>Saved campaign unavailable</Text>
      <Text style={styles.copy}>This locally submitted campaign could not be found in this account’s device storage.</Text>
      <Pressable accessibilityRole="button" onPress={() => goBackOr('/create')} style={styles.backButton}><Text style={styles.backButtonText}>Back to previous screen</Text></Pressable>
    </View></SafeAreaView>;
    return <LocalCampaignDetails campaign={localCampaign} userId={owner === 'device-draft' ? owner : (user?.id ?? 'device-draft')} shareId={id} accessToken={session?.access_token} />;
  }

  if (!campaign) {
    return <SafeAreaView style={styles.safe}>
      <View style={styles.notFound}>
        <Text style={styles.title}>Campaign not found</Text>
        <Text style={styles.copy}>This demo campaign may no longer be available.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/explore' as never)} style={styles.backButton}>
          <Text style={styles.backButtonText}>Back to Explore</Text>
        </Pressable>
      </View>
    </SafeAreaView>;
  }

  const simulatedTotalMinor = Math.min(Number.MAX_SAFE_INTEGER, parseUsdMinor(campaign.raised) + demoContributions.reduce((total, item) => Math.min(Number.MAX_SAFE_INTEGER, total + campaignFundingMinorForContribution(item)), 0));
  const statusFunding = calculateFundingProgress(parseUsdMinor(campaign.goal), simulatedTotalMinor);
  const statusText = campaign.status === 'completed' ? 'Successfully completed · goal reached' : campaign.status;
  const statusFundingLabel = statusFunding.percentage === null
    ? `Status: ${statusText}`
    : `Status: ${statusText} · ${statusFunding.percentage.toLocaleString('en-IN', { maximumFractionDigits: 1 })}% funded`;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.detailActions}>
          <Pressable accessibilityRole="button" onPress={() => goBackOr('/explore')} style={styles.backLink}>
            <Text style={styles.backLinkText}>‹  Back to Explore</Text>
          </Pressable>
        </View>
        <Image source={campaign.image} style={styles.cover} contentFit="cover" accessibilityLabel={`Campaign cover image for ${campaign.title}`} />
        <View style={styles.categoryRow}>
          <Text style={styles.category}>{campaign.category.toUpperCase()}</Text>
        </View>
        <Text accessibilityRole="header" style={styles.title}>{campaign.title}</Text>
        <Text style={styles.creator}>Created by {campaign.creator}</Text>
        <Text style={styles.meta}>Created {formatIsoDate(campaign.createdAt)} · {campaign.country}</Text>
        <View style={styles.statusShareRow}>
          <Text style={styles.status}>{statusFundingLabel}</Text>
          <CampaignShareAction campaignId={campaign.id} title={campaign.title} />
        </View>

        <StoryAndSources campaign={campaign} />
        <CampaignFeedback />
        <DemoFixtureFunding campaign={campaign} userId={user?.id} today={today} contributions={demoContributions} loadError={demoContributionLoadError} />
        <DemoCampaignAccordions campaign={campaign} />
      </ScrollView>
    </SafeAreaView>
  );
}

function DemoFixtureFunding({ campaign, userId, today, contributions, loadError }: {
  campaign: (typeof discoveryCampaigns)[number];
  userId?: string;
  today: ReturnType<typeof useUtcToday>;
  contributions: LocalDemoContribution[];
  loadError: string;
}) {
  const eligible = campaign.status !== 'In review' && !isDeadlineExpired(campaign.fundingDeadline, today);
  const ownCampaign = userId === campaign.creatorId;
  const simulatedMinor = contributions.reduce((total, item) => Math.min(Number.MAX_SAFE_INTEGER, total + campaignFundingMinorForContribution(item)), 0);
  const seededMinor = parseUsdMinor(campaign.raised);
  const demoTotalMinor = Math.min(Number.MAX_SAFE_INTEGER, seededMinor + simulatedMinor);
  const goalMinor = parseUsdMinor(campaign.goal);
  const progress = calculateFundingProgress(goalMinor, demoTotalMinor);
  const reachAtGoal = Math.round(campaign.goal * DEMO_REACH_PER_RUPEE);

  return <View style={styles.progressSection}>
    <Text accessibilityRole="header" style={styles.sectionTitle}>Campaign Progress</Text>
    <View style={styles.progressPanel}>
      <View style={styles.progressValueRow}>
        <Text style={styles.progressLabel}>Funding goal</Text>
        <Text style={styles.progressGoal}>{formatInrMinor(goalMinor)}</Text>
      </View>
      <View style={styles.progressValueRow}>
        <Text style={styles.progressLabel}>Fictional catalogue seed</Text>
        <Text style={styles.progressValue}>{formatInrMinor(seededMinor)}</Text>
      </View>
      <View style={styles.progressValueRow}>
        <Text style={styles.progressLabel}>Simulated demo contributions</Text>
        <Text style={styles.progressValue}>{formatInrMinor(simulatedMinor)}</Text>
      </View>
      <View style={styles.progressValueRow}>
        <Text style={styles.progressTotalLabel}>Demo progress total</Text>
        <Text style={styles.progressTotal}>{formatInrMinor(demoTotalMinor)}</Text>
      </View>
      <View style={styles.progressStatsRow}>
        <Text style={styles.progressPercent}>{progress.percentage === null ? '—' : `${progress.percentage.toLocaleString('en-IN', { maximumFractionDigits: 1 })}% funded`}</Text>
        <Text style={styles.progressRemaining}>{campaign.status === 'completed' ? 'Goal reached' : progress.remainingMinor === null ? 'Remaining —' : `${formatInrMinor(progress.remainingMinor)} remaining`}</Text>
      </View>
      <View accessibilityRole="progressbar" accessibilityLabel="Demo campaign funding progress" accessibilityValue={progress.percentage === null ? undefined : { min: 0, max: 100, now: Math.round(progress.barPercentage) }} style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress.barPercentage}%` }]} />
      </View>
      <View style={styles.demoNotice}>
        <Text style={styles.demoNoticeTitle}>Demo data only</Text>
        <Text style={styles.demoNoticeCopy}>All displayed funding figures are fictional or simulated prototype data. No real payments have been processed, and no money has been collected or transferred through this demo.</Text>
      </View>
      <View style={styles.reachCallout}>
        <Text style={styles.reachLabel}>ESTIMATED POTENTIAL REACH AT GOAL</Text>
        <Text style={styles.reach}>{reachAtGoal.toLocaleString('en-IN')} potential views</Text>
        <Text style={styles.figureFootnote}>Prototype assumption: {DEMO_REACH_PER_RUPEE} potential views per ₹1 of the funding goal. Illustrative, not guaranteed or delivered.</Text>
      </View>
      <View style={styles.deadlineBox}>
        <Text style={styles.deadline}>{getDeadlineLabel(campaign.fundingDeadline, today)}</Text>
        <Text style={styles.deadlineDate}>Deadline · {formatIsoDate(campaign.fundingDeadline)}</Text>
      </View>
    </View>
    <View style={styles.contributionBox}>
      {ownCampaign ? <>
        <Text style={styles.localSectionTitle}>You can&apos;t fund your own campaign</Text>
        <Text style={styles.distributionCopy}>Contributions are for supporters other than the campaign creator.</Text>
      </> : eligible ? <>
        <Text style={styles.localSectionTitle}>Back this campaign</Text>
        <Text style={styles.distributionCopy}>Continue to a separate demo contribution form. No payment is made during this flow.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/contribute/[id]', params: { id: campaign.id } } as never)} style={({ pressed }) => [styles.simulateButton, pressed && styles.pressed]}>
          <Text style={styles.simulateButtonText}>Back This Campaign</Text>
        </Pressable>
      </> : <Text style={styles.distributionCopy}>Demo contributions are unavailable because this fictional campaign is under review, completed, or its sample funding period has ended.</Text>}
      {loadError ? <Text accessibilityRole="alert" style={styles.contributionError}>{loadError}</Text> : null}
    </View>
  </View>;
}

function LocalCampaignDetails({ campaign, userId, shareId, accessToken }: { campaign: LocalCampaignDraft; userId: string; shareId: string; accessToken?: string }) {
  const [contributions, setContributions] = useState<Awaited<ReturnType<typeof readDemoContributions>>>([]);
  const [contributionError, setContributionError] = useState('');
  const goalMinor = parseUsdMinor(campaign.fundingGoal);
  const simulatedMinor = contributions.reduce((total, item) => Math.min(Number.MAX_SAFE_INTEGER, total + item.amountMinor), 0);
  const instagramBudgetMinor = parseUsdMinor(campaign.instagramBudget);
  const facebookBudgetMinor = parseUsdMinor(campaign.facebookBudget);
  const allocatedMinor = Math.min(Number.MAX_SAFE_INTEGER, instagramBudgetMinor + facebookBudgetMinor);
  const reachEstimate = Math.round((allocatedMinor / 100) * DEMO_REACH_PER_DOLLAR);
  const localProgress = calculateFundingProgress(goalMinor, simulatedMinor);
  const backendStatusLabel = campaign.backendStatus === 'approved' ? 'Approved · simulated contributions open'
    : campaign.backendStatus === 'under_review' ? 'Under review'
      : campaign.backendStatus === 'rejected' ? 'Rejected'
        : campaign.backendStatus === 'completed' ? 'Completed'
          : campaign.backendStatus === 'cancelled' ? 'Cancelled'
            : campaign.backendStatus === 'submitted' ? 'Submitted · awaiting review'
              : 'Accepted by SIGNAL API · awaiting review';

  useEffect(() => {
    let active = true;
    const pending = campaign.backendStatus === 'approved' && accessToken
      ? listDemoContributionsFromApi(campaign.id, accessToken)
      : readDemoContributions(userId, campaign.id);
    void pending.then((items) => {
      if (!active) return;
      setContributions(items);
    }).catch(() => {
      if (active) setContributionError('Local demo contribution storage is unavailable. No contribution was recorded.');
    });
    return () => { active = false; };
  }, [accessToken, campaign.backendStatus, campaign.id, userId]);

  const openSource = (url: string) => { void Linking.openURL(url).catch(() => undefined); };
  return <SafeAreaView style={styles.safe} edges={['top']}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.detailActions}>
        <Pressable accessibilityRole="button" onPress={() => goBackOr('/create')} style={styles.backLink}>
          <Text style={styles.backLinkText}>‹  Back to previous screen</Text>
        </Pressable>
        <CampaignShareAction campaignId={shareId} title={campaign.title || 'SIGNAL campaign'} />
      </View>
      <View style={styles.localStatusBox}>
        <Text style={styles.localStatusEyebrow}>{campaign.apiSubmissionStatus === 'submitted' ? 'SIGNAL API CAMPAIGN' : 'LOCAL CAMPAIGN'}</Text>
      <Text style={styles.localStatusText}>{campaign.localStatus === 'submitted_locally' ? campaign.apiSubmissionStatus === 'submitted' ? backendStatusLabel : campaign.apiSubmissionStatus === 'sync_failed' ? 'Saved locally · backend sync failed' : 'Submitted locally — awaiting backend connection' : 'Saved draft on this device'}</Text>
      <Text style={styles.disclaimer}>{campaign.localStatus === 'submitted_locally' ? campaign.apiSubmissionStatus === 'submitted' ? campaign.backendStatus === 'approved' ? 'The SIGNAL API confirmed campaign approval. This prototype supports simulated contributions only; no real payment processing is configured.' : `The SIGNAL API confirmed the campaign status: ${campaign.backendStatus ?? 'submitted'}. No real funding or payment is claimed.` : campaign.apiSubmissionStatus === 'sync_failed' ? 'This submission is saved on this device. The backend did not confirm receipt, and no review status is claimed.' : 'Saved on this device only. It has not been sent to SIGNAL or Supabase, and review has not begun.' : 'This campaign is a local draft. It has not been submitted to SIGNAL or Supabase.'}</Text>
      </View>
      <Text style={styles.missingCoverNote}>No uploaded cover image is available for this saved campaign. The draft’s cover field is metadata only.</Text>
      <View style={styles.localSection}>
        <Text style={styles.category}>{campaign.category || 'CAMPAIGN'}</Text>
        <Text style={styles.title}>{campaign.title || 'Untitled campaign'}</Text>
        <Text style={styles.cause}>{campaign.summary || 'No summary provided.'}</Text>
        <Text style={styles.creator}>Created by {campaign.creatorName || 'Creator not specified'}</Text>
      </View>
      <View style={styles.storySection}>
        <Text style={styles.eyebrow}>STORY &amp; SOURCES</Text>
        <Text accessibilityRole="header" style={styles.storyTitle}>The Story Behind the Campaign</Text>
        <Text style={styles.storyCopy}>{campaign.storyHeadline || campaign.summary || 'No story headline was provided.'}</Text>
        <Text style={styles.storyCopy}>{campaign.introduction || 'No introduction was provided for this campaign.'}</Text>
        {campaign.sections.map((section, index) => <View key={section.id} style={styles.storyBlock}>
          <Text style={styles.storySubheading}>{section.heading || `Story section ${index + 1}`}</Text>
          <Text style={styles.storyCopy}>{section.body}</Text>
        </View>)}
        {campaign.audienceActions ? <Text style={styles.storyCopy}><Text style={styles.localInlineLabel}>Suggested audience actions: </Text>{campaign.audienceActions}</Text> : null}
        {campaign.sources.length ? <View style={styles.sourceBlock}>
          <Text style={styles.storySubheading}>Sources &amp; References</Text>
          {campaign.sources.map((source, index) => <Pressable key={source.id} accessibilityRole="link" onPress={() => openSource(source.url)} style={styles.sourceItem}>
            <Text style={styles.sourceTitle}>{index + 1}. {source.title}</Text>
            <Text style={styles.sourceUrl}>{source.url}</Text>
          </Pressable>)}
        </View> : null}
      </View>
      <CampaignFeedback />
      <Text accessibilityRole="header" style={styles.sectionTitle}>Campaign Progress</Text>
      <View style={styles.progressPanel}>
        <View style={styles.progressValueRow}><Text style={styles.progressLabel}>Funding goal</Text><Text style={styles.progressGoal}>{goalMinor > 0 ? formatUsdMinor(goalMinor) : 'Not set'}</Text></View>
        <View style={styles.progressValueRow}><Text style={styles.progressLabel}>Simulated demo contributions</Text><Text style={styles.progressValue}>{formatUsdMinor(simulatedMinor)}</Text></View>
        <View style={styles.progressStatsRow}>
          <Text style={styles.progressPercent}>{localProgress.percentage === null ? 'Progress unavailable' : `${localProgress.percentage.toLocaleString('en-US', { maximumFractionDigits: 1 })}% funded`}</Text>
          <Text style={styles.progressRemaining}>{localProgress.remainingMinor === null ? 'Remaining —' : `${formatUsdMinor(localProgress.remainingMinor)} remaining`}</Text>
        </View>
        <View accessibilityRole="progressbar" accessibilityLabel="Demo campaign funding progress" accessibilityValue={localProgress.percentage === null ? undefined : { min: 0, max: 100, now: Math.round(localProgress.barPercentage) }} style={styles.progressTrack}><View style={[styles.progressFill, { width: `${localProgress.barPercentage}%` }]} /></View>
        <View style={styles.demoNotice}><Text style={styles.demoNoticeTitle}>Demo data only</Text><Text style={styles.demoNoticeCopy}>These totals are simulated local records. No payment has been processed and no money has been collected or transferred.</Text></View>
      </View>
      {campaign.localStatus === 'submitted_locally' && campaign.backendStatus === 'approved' && userId !== campaign.ownerId ? <View style={styles.contributionBox}>
        <Text style={styles.localSectionTitle}>Back this campaign</Text>
        <Text style={styles.distributionCopy}>Continue to the separate simulated contribution flow. No real payment is made.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/contribute/[id]', params: { id: shareId } } as never)} style={({ pressed }) => [styles.simulateButton, pressed && styles.pressed]}>
          <Text style={styles.simulateButtonText}>Back This Campaign</Text>
        </Pressable>
      </View> : campaign.backendStatus === 'approved' && userId === campaign.ownerId ? <View style={styles.contributionBox}>
        <Text style={styles.localSectionTitle}>You can&apos;t fund your own campaign</Text>
        <Text style={styles.distributionCopy}>Contributions are for supporters other than the campaign creator.</Text>
      </View> : campaign.localStatus === 'submitted_locally' ? <View style={styles.contributionBox}>
        <Text style={styles.localSectionTitle}>Contributions are not open yet</Text>
        <Text style={styles.distributionCopy}>The campaign must be approved before simulated contributions can be recorded.</Text>
      </View> : null}
      {contributionError ? <Text accessibilityRole="alert" style={styles.contributionError}>{contributionError}</Text> : null}
      <View style={styles.accordions}>
        <Accordion title="Use of Funds">
          <View style={styles.purposeNotice}><Text style={styles.purposeText}>Contributions fund distribution of the campaign message, not direct charitable support for the cause.</Text></View>
          <PolicyPoint title="Platform fees">No platform fee or fee percentage is configured for this prototype.</PolicyPoint>
          <PolicyPoint title="Portion available for advertising">Creator-entered channel budgets are planning values, not confirmed portions or ad purchases.</PolicyPoint>
          <PolicyPoint title="Allocation policies">No real funds are allocated or transferred by this prototype.</PolicyPoint>
          <PolicyPoint title="Refund conditions" infoSection="terms">No payment is processed, and no refund policy is configured.</PolicyPoint>
          <PolicyPoint title="Treatment of unspent funds">The prototype does not specify or process a policy for unspent funds.</PolicyPoint>
        </Accordion>
        <Accordion title="Audience & Distribution">
          <PolicyPoint title="Intended audience">A specific audience segment is not defined in this saved campaign.</PolicyPoint>
          <PolicyPoint title="Targeting choices">Locations: {campaign.locations.join(', ') || 'not provided'}; ages: {campaign.minimumAge || 'not set'} to {campaign.maximumAge || 'no maximum'}; interests: {campaign.interests || 'not provided'}. These are draft settings only.</PolicyPoint>
          <PolicyPoint title="Supported placements">Creator-selected channels: {campaign.channels.map((channel) => channel === 'instagram' ? 'Instagram' : 'Facebook').join(', ') || 'none specified'}. No advertising integration or purchase is configured.</PolicyPoint>
          <PolicyPoint title="Distribution approach">The campaign proposes message amplification. Planned channel budgets total {formatUsdMinor(allocatedMinor)} and support an illustrative estimate of {reachEstimate.toLocaleString('en-US')} potential views using {DEMO_REACH_PER_DOLLAR} potential views per $1 allocated. No ads have been delivered through SIGNAL, and the estimate is not guaranteed.</PolicyPoint>
          <PolicyPoint title="Privacy and advertising disclosures" infoSection="privacy">The draft stores creator-entered campaign settings. No advertising delivery integration is configured to send targeting selections to an ad platform.</PolicyPoint>
        </Accordion>
        <Accordion title="Review, Trust & Feedback">
          <PolicyPoint title="Review process">{campaign.apiSubmissionStatus === 'submitted' ? campaign.backendStatus === 'approved' ? 'The SIGNAL API confirmed approval. Simulated contributions can be recorded; actual payment processing remains unavailable.' : `The SIGNAL API confirmed campaign status: ${campaign.backendStatus ?? 'submitted'}.` : campaign.apiSubmissionStatus === 'sync_failed' ? 'The local submission was saved, but the backend did not confirm receipt.' : campaign.localStatus === 'submitted_locally' ? 'This campaign was submitted locally; backend review is not confirmed.' : 'This is a device-local draft and has not been submitted for review.'}</PolicyPoint>
          {campaign.sources.length ? <PolicyPoint title="Supporting sources">{`${campaign.sources.length} source reference(s) are attached above; presence does not imply independent verification.`}</PolicyPoint> : null}
          <PolicyPoint title="Verification information">No independent verification, audit, endorsement, or trust score is recorded.</PolicyPoint>
          <PolicyPoint title="Distribution partners" infoSection="partners">No confirmed distribution partners are configured or documented.</PolicyPoint>
        </Accordion>
      </View>
      <Pressable accessibilityRole="button" onPress={() => router.replace({ pathname: '/create', params: { newDraft: String(Date.now()) } } as never)} style={styles.backButton}>
        <Text style={styles.backButtonText}>Start another campaign</Text>
      </Pressable>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.paper },
  content: { paddingHorizontal: 22, paddingTop: 10, paddingBottom: 32, maxWidth: 680, width: '100%', alignSelf: 'center' },
  detailActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 9 },
  backLink: { alignSelf: 'flex-start', paddingVertical: 10, paddingRight: 12 },
  backLinkText: { color: C.text, fontSize: 13, fontWeight: '700' },
  shareWrap: { alignItems: 'flex-end', flexShrink: 0, gap: 4 },
  shareButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 15, borderRadius: 20, backgroundColor: C.green },
  shareButtonText: { color: C.paper, fontSize: 12, fontWeight: '700' },
  shareMessage: { color: C.error, fontSize: 11, lineHeight: 15, textAlign: 'right', maxWidth: 190 },
  shareModalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: 'rgba(22, 26, 20, 0.48)' },
  shareModal: { width: '100%', maxWidth: 420, padding: 20, borderRadius: 12, backgroundColor: C.paper, gap: 12 },
  shareModalTitle: { color: C.text, fontSize: 20, lineHeight: 26, fontWeight: '700' },
  shareModalCopy: { color: C.text, fontSize: 14, lineHeight: 20 },
  shareModalUrl: { color: C.green, fontSize: 12, lineHeight: 18, textDecorationLine: 'underline', padding: 10, borderRadius: 6, backgroundColor: C.surfaceSoft },
  shareModalStatus: { color: C.muted, fontSize: 12, lineHeight: 17 },
  shareModalActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 10, marginTop: 3 },
  shareCancelButton: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: C.line },
  shareCancelText: { color: C.text, fontSize: 12, fontWeight: '700' },
  cover: { width: '100%', height: 270, borderRadius: 9, overflow: 'hidden', marginBottom: 20, backgroundColor: C.surfaceSoft },
  categoryRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  category: { color: C.green, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  statusShareRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 48, borderBottomWidth: 1, borderBottomColor: C.line, paddingBottom: 10, marginTop: 4 },
  status: { color: C.text, fontSize: 12, lineHeight: 18, fontWeight: '700', flexGrow: 1, flexShrink: 1, minWidth: 150 },
  title: { color: C.text, fontSize: 31, lineHeight: 38, fontWeight: '600', letterSpacing: -0.6 },
  cause: { color: C.text, fontSize: 13, fontWeight: '600', marginTop: 5 },
  creator: { color: C.text, fontSize: 15, lineHeight: 21, marginTop: 11, fontWeight: '600' },
  meta: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  description: { color: C.text, fontSize: 14, lineHeight: 22, marginTop: 16 },
  reach: { color: C.text, fontSize: 18, lineHeight: 25, fontWeight: '700' },
  deadline: { color: C.text, fontSize: 13, fontWeight: '700' },
  deadlineDate: { color: C.muted, fontSize: 12, lineHeight: 18 },
  deadlineBox: { paddingTop: 12, borderTopWidth: 1, borderTopColor: C.line, gap: 3 },
  reachCallout: { marginTop: 12, paddingVertical: 12, paddingHorizontal: 13, borderRadius: 8, backgroundColor: C.surfaceSoft, gap: 4 },
  reachLabel: { color: C.green, fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  disclaimer: { color: C.muted, fontSize: 10, lineHeight: 15, marginTop: 7 },
  distributionCard: { borderRadius: 9, backgroundColor: C.surfaceSoft, padding: 16, marginTop: 13 },
  distributionLabel: { color: C.text, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  platform: { color: C.text, fontSize: 17, fontWeight: '700', marginTop: 7 },
  distributionCopy: { color: C.muted, fontSize: 11, lineHeight: 17, marginTop: 5 },
  footer: { color: C.muted, fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 18 },
  notFound: { flex: 1, justifyContent: 'center', padding: 24 },
  localStatusBox: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 9, padding: 15, marginBottom: 19, gap: 7 },
  localStatusEyebrow: { color: C.green, fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  localStatusText: { color: C.text, fontSize: 15, lineHeight: 21, fontWeight: '700' },
  missingCoverNote: { color: C.muted, fontSize: 12, lineHeight: 18, marginTop: -8, marginBottom: 8 },
  localSection: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.line, gap: 7 },
  localSectionTitle: { color: C.text, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  localStorySection: { borderLeftWidth: 2, borderLeftColor: C.line, paddingLeft: 12, paddingVertical: 5, gap: 4 },
  localInlineLabel: { color: C.text, fontWeight: '700' },
  sourceItem: { paddingVertical: 5, gap: 3 },
  sourceTitle: { color: C.text, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  sourceUrl: { color: C.green, fontSize: 11, lineHeight: 16, textDecorationLine: 'underline' },
  detailValue: { color: C.muted, fontSize: 12, lineHeight: 19 },
  contributionBox: { padding: 15, marginTop: 13, borderRadius: 9, backgroundColor: C.surface, gap: 10 },
  amountChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amountChoice: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 20, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper },
  amountChoiceSelected: { backgroundColor: C.green, borderColor: C.green },
  amountChoiceText: { color: C.text, fontSize: 12, fontWeight: '600' },
  amountChoiceTextSelected: { color: C.paper },
  simulateButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 22, backgroundColor: C.green },
  simulateButtonDisabled: { opacity: 0.55 },
  simulateButtonText: { color: C.paper, fontSize: 13, fontWeight: '700' },
  contributionSuccess: { color: C.green, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  contributionError: { color: C.error, fontSize: 12, lineHeight: 18 },
  storySection: { marginTop: 26, marginBottom: 30, gap: 14, maxWidth: 620, alignSelf: 'center', width: '100%' },
  eyebrow: { color: C.maroon, fontSize: 10, lineHeight: 15, fontWeight: '800', letterSpacing: 1.1 },
  storyTitle: { color: C.maroon, fontSize: 15, lineHeight: 21, fontWeight: '800', letterSpacing: 0.6 },
  storyDisclosure: { color: C.muted, fontSize: 12, lineHeight: 18, fontStyle: 'italic' },
  storyBlock: { gap: 8, marginTop: 3 },
  storyParagraphGroup: { gap: 12 },
  storySubheading: { color: C.text, fontSize: 17, lineHeight: 23, fontWeight: '700' },
  storyCopy: { color: C.text, fontSize: 15, lineHeight: 24 },
  storyPhotoBlock: { gap: 7, marginVertical: 5 },
  storyPhoto: { width: '100%', aspectRatio: 4 / 3, borderRadius: 8, backgroundColor: C.surfaceSoft },
  storyCaption: { color: C.muted, fontSize: 12, lineHeight: 18, fontStyle: 'italic' },
  figureFootnote: { color: C.muted, fontSize: 11, lineHeight: 17 },
  sourceBlock: { gap: 7, paddingTop: 5, borderTopWidth: 1, borderTopColor: C.line },
  feedbackSection: { marginTop: -2, marginBottom: 28, padding: 15, gap: 10, borderWidth: 1, borderColor: C.line, borderLeftWidth: 3, borderLeftColor: C.green, borderRadius: 9, backgroundColor: C.surface, maxWidth: 620, alignSelf: 'center', width: '100%' },
  feedbackTitle: { color: C.text, fontSize: 18, lineHeight: 24, fontWeight: '700' },
  feedbackCopy: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: -5 },
  feedbackQuestion: { gap: 7, paddingTop: 3 },
  feedbackQuestionText: { color: C.text, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  feedbackOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  feedbackOption: { minHeight: 36, minWidth: 62, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 13, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper },
  feedbackOptionSelected: { borderColor: C.green, backgroundColor: C.green },
  feedbackOptionText: { color: C.text, fontSize: 12, fontWeight: '600' },
  feedbackOptionTextSelected: { color: C.paper },
  feedbackSubmit: { minHeight: 40, alignSelf: 'flex-start', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, borderRadius: 20, backgroundColor: C.green, marginTop: 2 },
  feedbackSubmitText: { color: C.paper, fontSize: 12, fontWeight: '700' },
  feedbackConfirmation: { gap: 3, padding: 10, borderRadius: 6, backgroundColor: C.maroonLight },
  feedbackConfirmationHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  feedbackConfirmationIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: C.green },
  feedbackConfirmationCheck: { color: C.paper, fontSize: 15, lineHeight: 18, fontWeight: '800' },
  feedbackConfirmationTitle: { color: C.maroon, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  feedbackConfirmationCopy: { color: C.text, fontSize: 11, lineHeight: 17 },
  sectionTitle: { color: C.text, fontSize: 23, lineHeight: 30, fontWeight: '600', letterSpacing: -0.2, marginTop: 5, marginBottom: 12 },
  progressSection: { marginTop: 0, marginBottom: 28 },
  progressPanel: { backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 9, padding: 16, gap: 12 },
  progressValueRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  progressLabel: { color: C.muted, fontSize: 13, lineHeight: 19, flexShrink: 1 },
  progressGoal: { color: C.text, fontSize: 22, lineHeight: 28, fontWeight: '800' },
  progressValue: { color: C.text, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  progressTotalLabel: { color: C.text, fontSize: 14, lineHeight: 20, fontWeight: '700', flexShrink: 1 },
  progressTotal: { color: C.green, fontSize: 18, lineHeight: 24, fontWeight: '800' },
  progressStatsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginTop: 2 },
  progressPercent: { color: C.green, fontSize: 14, lineHeight: 20, fontWeight: '800' },
  progressRemaining: { color: C.muted, fontSize: 12, lineHeight: 18, flexShrink: 1, textAlign: 'right' },
  progressTrack: { height: 8, borderRadius: 4, backgroundColor: C.surfaceSoft, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.green, borderRadius: 4 },
  demoNotice: { backgroundColor: C.maroonLight, borderLeftWidth: 3, borderLeftColor: C.maroon, padding: 12, gap: 4, borderRadius: 5 },
  demoNoticeTitle: { color: C.maroon, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  demoNoticeCopy: { color: C.text, fontSize: 12, lineHeight: 19 },
  accordions: { marginTop: 26, marginBottom: 24, borderTopWidth: 1, borderTopColor: C.line },
  accordion: { borderBottomWidth: 1, borderBottomColor: C.line },
  accordionHeader: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  accordionTitle: { color: C.text, fontSize: 17, lineHeight: 23, fontWeight: '700', flex: 1 },
  accordionChevron: { color: C.green, fontSize: 25, lineHeight: 29, fontWeight: '500' },
  accordionBody: { paddingBottom: 18, gap: 15 },
  accordionCopy: { color: C.muted, fontSize: 13, lineHeight: 21 },
  policyPoint: { gap: 4 },
  policyHeading: { color: C.text, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  infoLink: { alignSelf: 'flex-start', paddingVertical: 4, marginTop: 1 },
  infoLinkText: { color: C.green, fontSize: 12, lineHeight: 18, fontWeight: '700', textDecorationLine: 'underline' },
  purposeNotice: { borderWidth: 1, borderColor: C.error, borderRadius: 7, backgroundColor: C.paper, padding: 13, marginBottom: 2 },
  purposeText: { color: C.text, fontSize: 14, lineHeight: 21, fontWeight: '700' },
  pressed: { opacity: 0.72 },
  copy: { color: C.muted, fontSize: 14, marginTop: 8 },
  backButton: { alignSelf: 'flex-start', borderRadius: 6, paddingHorizontal: 16, paddingVertical: 11, backgroundColor: C.brown, marginTop: 20 },
  backButtonText: { color: C.espresso, fontSize: 12, fontWeight: '700' },
});
