/** Presentation-only formatting. No business logic lives here. */

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percent = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const weightPercent = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const wholePercent = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 0,
});

export function formatMoney(value: number): string {
  return currency.format(value);
}

/** Signed percent, e.g. "+1.82%" / "−0.71%" (true minus sign). */
export function formatSignedPercent(fraction: number): string {
  const sign = fraction > 0 ? '+' : fraction < 0 ? '−' : '';
  return `${sign}${percent.format(Math.abs(fraction))}`;
}

/** Unsigned weight, e.g. "18.4%". */
export function formatWeight(fraction: number): string {
  return weightPercent.format(fraction);
}

/** A ratio, e.g. "1.63" or "−0.42". */
export function formatRatio(value: number): string {
  const sign = value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(2)}`;
}

/** A percentile as a place, e.g. "89th", "1st", "0th". */
export function formatPercentile(percentile: number): string {
  const whole = Math.round(percentile);
  const lastTwo = whole % 100;
  const last = whole % 10;
  const suffix =
    lastTwo >= 11 && lastTwo <= 13 ? 'th'
    : last === 1 ? 'st'
    : last === 2 ? 'nd'
    : last === 3 ? 'rd'
    : 'th';
  return `${whole}${suffix}`;
}

/** Momentum blend score, e.g. "96.4". */
export function formatScore(score: number): string {
  return score.toFixed(1);
}

/** Signed percent at whole-number precision, e.g. "+184%". */
export function formatSignedPercentWhole(fraction: number): string {
  const sign = fraction > 0 ? '+' : fraction < 0 ? '−' : '';
  return `${sign}${wholePercent.format(Math.abs(fraction))}`;
}

export type Direction = 'up' | 'down' | 'flat';

export function directionOf(value: number): Direction {
  if (value > 0) return 'up';
  if (value < 0) return 'down';
  return 'flat';
}
