/** Home-page prototype assumption; potential views per ₹1 of campaign funding. */
export const DEMO_REACH_PER_RUPEE = 12;

/** Fixed demo-only conversion used to compare USD contributions with INR catalogue goals.
 * It is an illustrative model setting, not a live or current exchange rate.
 */
export const DEMO_RUPEES_PER_USD = 80;

/** Convert USD cents into INR paise using the documented fixed prototype assumption. */
export function demoUsdToInrMinor(usdMinor: number): number {
  if (!Number.isSafeInteger(usdMinor) || usdMinor <= 0) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, usdMinor * DEMO_RUPEES_PER_USD);
}

/** Return a contribution's campaign-currency value, including records written before this field existed. */
export function campaignFundingMinorForContribution(record: { amountMinor: number; campaignAmountMinor?: number; campaignCurrency?: 'INR' | 'USD' }): number {
  if (Number.isSafeInteger(record.campaignAmountMinor) && (record.campaignAmountMinor ?? 0) > 0) return record.campaignAmountMinor!;
  return record.campaignCurrency === 'USD' ? record.amountMinor : demoUsdToInrMinor(record.amountMinor);
}
