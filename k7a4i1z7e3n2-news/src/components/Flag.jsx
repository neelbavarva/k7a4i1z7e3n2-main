import US from '../assets/flags/US.svg';
import EU from '../assets/flags/EU.svg';
import GB from '../assets/flags/GB.svg';
import AU from '../assets/flags/AU.svg';
import NZ from '../assets/flags/NZ.svg';
import CA from '../assets/flags/CA.svg';
import CH from '../assets/flags/CH.svg';
import JP from '../assets/flags/JP.svg';
import CN from '../assets/flags/CN.svg';

// Currency -> round flag (country-flag-icons, MIT; see assets/flags/LICENSE.txt)
export const FLAGS = { USD: US, EUR: EU, GBP: GB, AUD: AU, NZD: NZ, CAD: CA, CHF: CH, JPY: JP, CNY: CN };

/**
 * A currency's round flag. The calendar also lists events for no one country ("All", such as
 * OPEC meetings), which get a plain globe.
 */
export function CurrencyFlag({ ccy, size = 16 }) {
  const src = FLAGS[ccy];
  return (
    <span className="flag" style={{ '--flag': `${size}px` }} aria-hidden="true">
      {src ? (
        <img src={src} alt="" draggable="false" />
      ) : (
        <svg viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="6.4" />
          <path d="M1.6 8h12.8M8 1.6c1.9 1.8 2.8 3.9 2.8 6.4S9.9 12.6 8 14.4C6.1 12.6 5.2 10.5 5.2 8S6.1 3.4 8 1.6z" />
        </svg>
      )}
    </span>
  );
}
