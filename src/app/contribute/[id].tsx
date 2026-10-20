import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAuth } from '@/auth/auth-context';
import { CampaignIdentity, FlowButton, FlowCard, FlowLink, FlowPage, FlowTextInput, InfoNote } from '@/components/contributions/flow-ui';
import { loadContributionCampaign, type ContributionCampaign } from '@/data/contribution-campaign';
import {
  campaignCurrencyAmountForUsd,
  CONTRIBUTION_PRESETS_MINOR,
  createContributionFlowId,
  estimatePotentialReach,
  parseUsdAmountInput,
  writeContributionFlow,
} from '@/data/contribution-flow';
import { DEMO_REACH_PER_RUPEE, DEMO_RUPEES_PER_USD } from '@/data/demo-reach';
import { isDeadlineExpired, type IsoDate } from '@/data/campaigns';
import { Palette as C } from '@/constants/theme';
import { DEMO_REACH_PER_DOLLAR } from '@/types/local-campaign';
import { useUtcToday } from '@/hooks/use-utc-today';

export default function ContributionFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, session } = useAuth();
  const today = useUtcToday();
  const [campaign, setCampaign] = useState<ContributionCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [amountText, setAmountText] = useState('25');
  const [selectedPreset, setSelectedPreset] = useState('25');
  const [showFirstName, setShowFirstName] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [coupon, setCoupon] = useState('');
  const [couponMessage, setCouponMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    if (!id) return () => { active = false; };
    void loadContributionCampaign(id, { userId: user?.id, accessToken: session?.access_token }).then((value) => {
      if (active) { setCampaign(value); setLoadError(value ? '' : 'This campaign could not be found.'); }
    }).catch((caught) => {
      if (active) setLoadError(caught instanceof Error ? caught.message : 'The campaign could not be loaded.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, session?.access_token, user?.id]);

  const parsedAmount = useMemo(() => parseUsdAmountInput(amountText), [amountText]);
  const amountIsValid = parsedAmount !== null && parsedAmount >= 100 && parsedAmount <= 100000;
  const nameValue = firstName.trim().split(/\s+/)[0].slice(0, 40);
  const canContribute = campaign?.origin === 'catalog'
    ? campaign.creatorId !== user?.id && campaign.status !== 'In review' && campaign.status !== 'completed' && !(campaign.fundingDeadline && isDeadlineExpired(campaign.fundingDeadline as IsoDate, today))
    : campaign?.origin === 'api' && campaign.backendStatus === 'approved' && campaign.ownerId !== user?.id;

  function setPreset(amountMinor: number) {
    const dollars = (amountMinor / 100).toString();
    setAmountText(dollars);
    setSelectedPreset(dollars);
    setError('');
  }

  function changeAmount(value: string) {
    if (!/^\d*\.?\d{0,2}$/.test(value)) return;
    setAmountText(value);
    const amount = parseUsdAmountInput(value);
    const matching = CONTRIBUTION_PRESETS_MINOR.find((preset) => preset === amount);
    setSelectedPreset(matching === undefined ? 'other' : String(matching / 100));
    setError('');
  }

  async function continueToReview() {
    if (!campaign || !canContribute || !amountIsValid) {
      setError(!amountIsValid ? 'Enter an amount from $1.00 to $1,000.00.' : 'This campaign is not currently accepting contributions.');
      return;
    }
    if (showFirstName && !nameValue) { setError('Enter a first name or turn off the optional display preference.'); return; }
    setSaving(true);
    setError('');
    try {
      const campaignAmountMinor = campaignCurrencyAmountForUsd(parsedAmount!, campaign.currency);
      const now = new Date().toISOString();
      const flowId = createContributionFlowId();
      await writeContributionFlow({
        id: flowId,
        campaignRouteId: campaign.routeId,
        campaignId: campaign.id,
        campaignTitle: campaign.title,
        origin: campaign.origin === 'api' ? 'api' : 'catalog',
        amountMinor: parsedAmount!,
        currency: 'USD',
        feeMinor: 0,
        totalMinor: parsedAmount!,
        campaignAmountMinor,
        campaignCurrency: campaign.currency,
        estimatedPotentialReach: estimatePotentialReach(parsedAmount!, campaign.currency),
        showFirstName,
        ...(showFirstName ? { firstName: nameValue } : {}),
        status: 'review',
        createdAt: now,
        updatedAt: now,
      });
      router.push({ pathname: '/contribute/review/[flowId]', params: { flowId } } as never);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The contribution review could not be opened.');
    } finally { setSaving(false); }
  }

  if (!id) return <FlowPage title="Campaign unavailable" subtitle="Campaign ID is missing.">
    <FlowButton title="Return to Explore" onPress={() => router.replace('/explore' as never)} />
  </FlowPage>;
  if (loading) return <FlowPage title="Back a Campaign" subtitle="Loading campaign details…" />;
  if (!campaign) return <FlowPage title="Campaign unavailable" subtitle={loadError}>
    <FlowButton title="Return to Explore" onPress={() => router.replace('/explore' as never)} />
  </FlowPage>;

  return <FlowPage title="Back a Campaign" subtitle="Choose a demo contribution for this campaign. No payment will occur until you complete the simulated checkout.">
    <CampaignIdentity campaign={campaign} />
    <FlowCard title="Choose an amount (USD)">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {CONTRIBUTION_PRESETS_MINOR.map((amount) => {
          const label = `$${amount / 100}`;
          const selected = selectedPreset === String(amount / 100);
          return <Pressable key={amount} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setPreset(amount)} style={({ pressed }) => [styles.amountChoice, selected && styles.amountChoiceSelected, pressed && styles.pressed]}>
            <Text style={[styles.amountChoiceText, selected && styles.amountChoiceTextSelected]}>{label}</Text>
          </Pressable>;
        })}
        <Pressable accessibilityRole="button" accessibilityState={{ selected: selectedPreset === 'other' }} onPress={() => setSelectedPreset('other')} style={({ pressed }) => [styles.amountChoice, selectedPreset === 'other' && styles.amountChoiceSelected, pressed && styles.pressed]}>
          <Text style={[styles.amountChoiceText, selectedPreset === 'other' && styles.amountChoiceTextSelected]}>Other</Text>
        </Pressable>
      </View>
      <FlowTextInput label="Contribution amount in USD" value={amountText} onChangeText={changeAmount} keyboardType="decimal-pad" placeholder="Enter an amount" maxLength={8} inputMode="decimal" />
      <Text style={styles.validationHint}>Minimum $1.00 · maximum $1,000.00. Enter numbers only; up to two decimal places.</Text>
    </FlowCard>

    <FlowCard title="Coupon code">
      <Text style={styles.body}>Coupons are not configured in this demo. No code will apply a discount.</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <FlowTextInput label="Coupon code (demo only)" value={coupon} onChangeText={(value) => { setCoupon(value); setCouponMessage(''); }} autoCapitalize="characters" containerStyle={{ flex: 1 }} />
        <Pressable accessibilityRole="button" onPress={() => setCouponMessage(coupon.trim() ? 'Coupons are unsupported in this demo. No discount has been applied.' : 'Enter a code to check it. Coupon validation is unavailable in this demo.')} style={({ pressed }) => [styles.applyButton, pressed && styles.pressed]}>
          <Text style={styles.applyText}>Apply</Text>
        </Pressable>
      </View>
      {couponMessage ? <Text accessibilityLiveRegion="polite" style={styles.validationHint}>{couponMessage}</Text> : null}
    </FlowCard>

    <FlowCard title="Optional preferences">
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: showFirstName }} onPress={() => { setShowFirstName((value) => !value); setError(''); }} style={styles.preferenceRow}>
        <View style={[styles.checkbox, showFirstName && styles.checkboxSelected]}><Text style={styles.checkboxMark}>{showFirstName ? '✓' : ''}</Text></View>
        <Text style={styles.preferenceCopy}>Show my first name as a recent backer on this campaign.</Text>
      </Pressable>
      {showFirstName ? <FlowTextInput label="First name to display" value={firstName} onChangeText={setFirstName} maxLength={40} autoCapitalize="words" hint="Only this first name is stored with a successful demo contribution. You can leave display off instead." /> : null}
      <Pressable accessibilityRole="checkbox" accessibilityState={{ disabled: true, checked: false }} disabled style={[styles.preferenceRow, styles.preferenceDisabled]}>
        <View style={styles.checkbox}><Text style={styles.checkboxMark} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.preferenceCopy}>Save my payment method for one-tap contributions in the future.</Text>
          <Text style={styles.validationHint}>Unavailable in this demo. No payment method or card details are collected or stored.</Text>
        </View>
      </Pressable>
    </FlowCard>

    <FlowCard title="Estimated potential reach">
      {amountIsValid ? <Text style={styles.reachValue}>Approximately {estimatePotentialReach(parsedAmount!, campaign.currency).toLocaleString('en-US')} potential views</Text> : <Text style={styles.body}>Enter a valid contribution amount to see the estimate.</Text>}
      {campaign.currency === 'INR'
        ? <Text style={styles.validationHint}>Illustrative only: uses the catalogue&apos;s configured {DEMO_REACH_PER_RUPEE} potential views per ₹1 and a fixed demo assumption of $1 = ₹{DEMO_RUPEES_PER_USD}. This is not a live exchange rate or measured reach.</Text>
        : <Text style={styles.validationHint}>Illustrative only: uses the API campaign demo assumption of {DEMO_REACH_PER_DOLLAR} potential views per $1. This is not measured or guaranteed reach.</Text>}
    </FlowCard>

    {!canContribute ? <InfoNote tone="error">{campaign.origin === 'api' && campaign.backendStatus !== 'approved'
      ? 'API campaigns accept contributions only after approval.'
      : campaign.ownerId === user?.id || campaign.creatorId === user?.id
        ? 'Campaign creators cannot contribute to their own campaign.'
        : 'This campaign is not accepting contributions.'}</InfoNote> : null}
    {error ? <InfoNote tone="error">{error}</InfoNote> : null}
    {loadError ? <InfoNote tone="error">{loadError}</InfoNote> : null}
    <FlowButton title="Continue to contribution review" disabled={!canContribute || !amountIsValid || saving} onPress={() => { void continueToReview(); }} />
    <FlowLink title="Return to campaign details" onPress={() => router.replace({ pathname: '/campaign/[id]', params: { id: campaign.routeId } } as never)} />
  </FlowPage>;
}

const styles = {
  amountChoice: { minWidth: 70, minHeight: 43, alignItems: 'center' as const, justifyContent: 'center' as const, paddingHorizontal: 14, borderRadius: 9, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper },
  amountChoiceSelected: { borderColor: C.green, backgroundColor: C.backgroundSelected },
  amountChoiceText: { color: C.text, fontSize: 14, fontWeight: '700' as const },
  amountChoiceTextSelected: { color: C.green },
  pressed: { opacity: 0.75 },
  validationHint: { color: C.muted, fontSize: 11, lineHeight: 17 },
  body: { color: C.muted, fontSize: 13, lineHeight: 19 },
  applyButton: { minHeight: 44, paddingHorizontal: 17, alignItems: 'center' as const, justifyContent: 'center' as const, borderRadius: 22, backgroundColor: C.green, marginBottom: 1 },
  applyText: { color: C.paper, fontWeight: '700' as const, fontSize: 12 },
  preferenceRow: { flexDirection: 'row' as const, gap: 10, alignItems: 'flex-start' as const },
  preferenceDisabled: { opacity: 0.68, marginTop: 4 },
  preferenceCopy: { flex: 1, color: C.text, fontSize: 13, lineHeight: 19 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: C.muted, alignItems: 'center' as const, justifyContent: 'center' as const, backgroundColor: C.paper, marginTop: 1 },
  checkboxSelected: { backgroundColor: C.green, borderColor: C.green },
  checkboxMark: { color: C.paper, fontSize: 13, lineHeight: 16, fontWeight: '800' as const },
  reachValue: { color: C.green, fontSize: 19, lineHeight: 25, fontWeight: '800' as const },
};
