// Number formatting for the position size calculator (en-US, like the rest of the page).

const cache = new Map<string, Intl.NumberFormat>();

function fmt(key: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat('en-US', options);
    cache.set(key, f);
  }
  return f;
}

/** "$1,234.56", "¥15,774", "₹8,812.40" */
export function formatMoney(v: number, currency: string): string {
  try {
    return fmt(`m${currency}`, { style: 'currency', currency }).format(v);
  } catch {
    return `${formatNumber(v, 2)} ${currency}`;
  }
}

/** The account currency's symbol on its own: "$", "€", "AED". */
export function currencySymbol(currency: string): string {
  try {
    return fmt(`s${currency}`, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find((p) => p.type === 'currency')!.value;
  } catch {
    return currency;
  }
}

/** Up to `max` decimals, grouped: 50,000 · 0.5 · 1,234.25 */
export const formatNumber = (v: number, max = 2, min = 0) => fmt(`n${max}-${min}`, { maximumFractionDigits: max, minimumFractionDigits: min }).format(v);

/** A price to its instrument's digits: 1.11847, 157.738, 4,131.92 */
export const formatPrice = (v: number, digits: number) => formatNumber(v, digits, digits);

/** A conversion rate with about five significant figures: 0.0063397, 1.1185, 157.74 */
export function formatRate(v: number): string {
  const digits = v >= 1000 ? 2 : v >= 1 ? 5 - Math.floor(Math.log10(v)) - 1 : Math.min(8, 4 - Math.floor(Math.log10(v)));
  return formatNumber(v, Math.max(0, digits), Math.max(0, digits));
}

/** "1.00%", "0.25%", "12.5%" */
export const formatPercent = (v: number) => `${formatNumber(v, v >= 10 ? 1 : 2, v >= 10 ? 0 : 2)}%`;
