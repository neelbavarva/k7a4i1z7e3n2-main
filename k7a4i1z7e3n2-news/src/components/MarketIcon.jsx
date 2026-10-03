import US from '../assets/flags/US.svg';
import EU from '../assets/flags/EU.svg';
import GB from '../assets/flags/GB.svg';
import AU from '../assets/flags/AU.svg';
import NZ from '../assets/flags/NZ.svg';
import CA from '../assets/flags/CA.svg';
import CH from '../assets/flags/CH.svg';
import JP from '../assets/flags/JP.svg';

// Currency -> round flag (country-flag-icons, MIT; see assets/flags/LICENSE.txt)
const FLAGS = { USD: US, EUR: EU, GBP: GB, AUD: AU, NZD: NZ, CAD: CA, CHF: CH, JPY: JP };

// Metals, oil and indices: an original symbol each (no third-party logos)
const COINS = {
  XAUUSD: { text: 'Au', from: '#f8e08e', to: '#c7951e', ink: '#5a3d00' },
  XAGUSD: { text: 'Ag', from: '#f4f6f8', to: '#9aa4ad', ink: '#3b4249' },
  COPPER: { text: 'Cu', from: '#f6b48a', to: '#b2582a', ink: '#4d1f06' },
};
const INDEX = { US500: '500', NAS100: '100', US30: '30' };

function Coin({ id }) {
  const c = COINS[id];
  const g = `coin-${id}`;
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <radialGradient id={g} cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor={c.from} />
          <stop offset="1" stopColor={c.to} />
        </radialGradient>
      </defs>
      <circle cx="20" cy="20" r="20" fill={`url(#${g})`} />
      <circle cx="20" cy="20" r="15.5" fill="none" stroke={c.ink} strokeOpacity="0.22" strokeWidth="1.2" />
      <text x="20" y="25.6" textAnchor="middle" fontSize="15" fontWeight="700" fill={c.ink} fontFamily="Instrument Sans Variable, system-ui, sans-serif">
        {c.text}
      </text>
    </svg>
  );
}

function Oil() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="#1f2422" />
      <path d="M20 8.5c4.8 6.4 7.6 10.9 7.6 14.6a7.6 7.6 0 0 1-15.2 0c0-3.7 2.8-8.2 7.6-14.6z" fill="#f2f2ec" />
      <path d="M16.2 23.4a3.9 3.9 0 0 0 3.6 3.9" fill="none" stroke="#1f2422" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function Index({ id }) {
  const label = INDEX[id];
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="#1d3557" />
      <path d="M8.5 27.5l6.5-6 4.5 3.5 9-9.5" fill="none" stroke="#7fb3ff" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <text x="20" y={label.length > 2 ? 24.6 : 25.4} textAnchor="middle" fontSize={label.length > 2 ? 13 : 15} fontWeight="700" fill="#fff" fontFamily="Instrument Sans Variable, system-ui, sans-serif">
        {label}
      </text>
    </svg>
  );
}

function Primary({ pair }) {
  if (FLAGS[pair.base]) return <img src={FLAGS[pair.base]} alt="" draggable="false" />;
  if (COINS[pair.id]) return <Coin id={pair.id} />;
  if (INDEX[pair.id]) return <Index id={pair.id} />;
  if (pair.id === 'USOIL') return <Oil />;
  return <span className="mi-text">{pair.symbol.slice(0, 2)}</span>;
}

/**
 * Round market icon: two overlapping flags for forex (base in front), or the
 * instrument's own symbol with a small dollar flag behind it (all priced in USD).
 */
export default function MarketIcon({ pair, size = 22 }) {
  const quote = FLAGS[pair.quote];
  return (
    <span className="mi" style={{ '--mi': typeof size === 'number' ? `${size}px` : size }} aria-hidden="true">
      <span className="mi-a">
        <Primary pair={pair} />
      </span>
      {quote && (
        <span className="mi-b">
          <img src={quote} alt="" draggable="false" />
        </span>
      )}
    </span>
  );
}
