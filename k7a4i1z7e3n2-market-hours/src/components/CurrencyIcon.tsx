import type { ReactNode } from 'react';
import type { Instrument } from '../instruments';

// Round icons for what the calculator sizes: a flag for each currency, a stamped token with the
// element's symbol for each metal, and a coin for each crypto. All flat colour, no gradients.

const FLAG_URLS = import.meta.glob<string>('../assets/flags/*.svg', { eager: true, query: '?url', import: 'default' });

/** The country (or union) whose flag stands for a currency. */
const COUNTRY: Record<string, string> = {
  USD: 'US',
  EUR: 'EU',
  GBP: 'GB',
  JPY: 'JP',
  CHF: 'CH',
  CAD: 'CA',
  AUD: 'AU',
  NZD: 'NZ',
  SGD: 'SG',
  HKD: 'HK',
  ZAR: 'ZA',
  MXN: 'MX',
  TRY: 'TR',
  NOK: 'NO',
  SEK: 'SE',
  DKK: 'DK',
  PLN: 'PL',
  HUF: 'HU',
  CZK: 'CZ',
  CNH: 'CN',
  THB: 'TH',
  INR: 'IN',
  AED: 'AE',
};

const METALS: Record<string, string> = { XAU: 'Au', XAG: 'Ag', XPT: 'Pt', XPD: 'Pd' };

// coin faces on a 24-unit circle, drawn in white
const COINS: Record<string, ReactNode> = {
  BTC: (
    <path
      transform="rotate(14 12 12)"
      d="M9.6 6.6v10.8M8 6.6h5.1a2.5 2.5 0 0 1 0 5H9.6m0 0h4.3a2.9 2.9 0 0 1 0 5.8H8M11.1 5v1.6m2 -1.6v1.6m-2 10.8V19m2-1.6V19"
      fill="none"
      stroke="#fff"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  ETH: (
    <g fill="#fff">
      <path d="M12 4.2 7.4 12 12 14.7z" />
      <path d="M12 4.2 16.6 12 12 14.7z" opacity=".72" />
      <path d="M12 15.7 7.4 13 12 19.6z" />
      <path d="M12 15.7 16.6 13 12 19.6z" opacity=".72" />
    </g>
  ),
  SOL: <path fill="#14F195" d="M8.6 7.4h9.6l-2.6 2.5H6zM6 10.8h9.6l2.6 2.5H8.6zM8.6 14.2h9.6l-2.6 2.5H6z" />,
  XRP: (
    <path
      d="M7 6.8l3.3 3.3a2.4 2.4 0 0 0 3.4 0L17 6.8M7 17.2l3.3-3.3a2.4 2.4 0 0 1 3.4 0l3.3 3.3"
      fill="none"
      stroke="#fff"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  LTC: (
    <path d="M11 6.5 9.2 16.6h7.3M7.6 13.1l6-2.3" fill="none" stroke="#fff" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
  ),
};

/** A currency's flag, a metal's token or a coin, as a circle `size` pixels across. */
export function CurrencyIcon({ code, size = 20 }: { code: string; size?: number }) {
  const style = { width: size, height: size };
  const url = COUNTRY[code] ? FLAG_URLS[`../assets/flags/${COUNTRY[code]}.svg`] : undefined;
  if (url) return <img className="flag" src={url} alt="" width={size} height={size} style={style} />;
  if (METALS[code]) {
    return (
      <svg className={`flag token token-${code.toLowerCase()}`} viewBox="0 0 24 24" style={style} aria-hidden="true">
        <circle cx="12" cy="12" r="12" />
        <circle cx="12" cy="12" r="9.2" className="token-ring" />
        <text x="12" y="15.6" textAnchor="middle">
          {METALS[code]}
        </text>
      </svg>
    );
  }
  if (COINS[code]) {
    return (
      <svg className={`flag token token-${code.toLowerCase()}`} viewBox="0 0 24 24" style={style} aria-hidden="true">
        <circle cx="12" cy="12" r="12" />
        {COINS[code]}
      </svg>
    );
  }
  return (
    <span className="flag token token-plain" style={{ ...style, fontSize: size * 0.36 }} aria-hidden="true">
      {code.slice(0, 2)}
    </span>
  );
}

/** Base over quote: the base's icon at the top left, the quote's tucked under it at the bottom right. */
export function PairIcon({ inst, size = 28 }: { inst: Instrument; size?: number }) {
  const each = Math.round(size * 0.66);
  return (
    <span className="pair-icon" style={{ width: size, height: size }} aria-hidden="true">
      <CurrencyIcon code={inst.base} size={each} />
      <CurrencyIcon code={inst.quote} size={each} />
    </span>
  );
}
