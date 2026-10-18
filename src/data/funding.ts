export type FundingProgress = {
  goalMinor: number;
  raisedMinor: number;
  remainingMinor: number | null;
  percentage: number | null;
  barPercentage: number;
};

function safeMinor(value: number): number {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export function parseUsdMinor(value: string | number): number {
  const amount = typeof value === 'number' ? value : Number(value.trim());
  if (!Number.isFinite(amount) || amount <= 0 || amount > Number.MAX_SAFE_INTEGER / 100) return 0;
  const minor = Math.round(amount * 100);
  return Number.isSafeInteger(minor) ? minor : 0;
}

export function calculateFundingProgress(goalValue: number, raisedValue: number): FundingProgress {
  const goalMinor = safeMinor(goalValue);
  const raisedMinor = safeMinor(raisedValue);
  const percentage = goalMinor > 0 ? (raisedMinor / goalMinor) * 100 : null;
  return {
    goalMinor,
    raisedMinor,
    remainingMinor: goalMinor > 0 ? Math.max(goalMinor - raisedMinor, 0) : null,
    percentage: percentage !== null && Number.isFinite(percentage) ? percentage : null,
    barPercentage: percentage !== null && Number.isFinite(percentage) ? Math.max(0, Math.min(percentage, 100)) : 0,
  };
}

export function formatUsdMinor(value: number): string {
  const minor = safeMinor(value);
  return `${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(minor / 100)} USD`;
}
