/* eslint-disable @next/next/no-img-element */
import { REGION_BADGE, isCountry } from '@/lib/markets';

// Round flags from country-flag-icons (MIT; see public/flags/LICENSE.txt), the same set
// FX Fundamental Bias uses. Regions and the World get an original lettered badge.
function Globe() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="#1d3557" />
      <circle cx="20" cy="20" r="11" fill="none" stroke="#9cc3ff" strokeOpacity="0.75" strokeWidth="1.8" />
      <ellipse cx="20" cy="20" rx="4.8" ry="11" fill="none" stroke="#9cc3ff" strokeOpacity="0.75" strokeWidth="1.6" />
      <path d="M9 20h22M11 14.5h18M11 25.5h18" stroke="#9cc3ff" strokeOpacity="0.55" strokeWidth="1.4" />
    </svg>
  );
}

function Region({ code }: { code: string }) {
  const label = REGION_BADGE[code] ?? code.slice(0, 3);
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="#2b3a2f" />
      <circle cx="20" cy="20" r="15.5" fill="none" stroke="#ffffff" strokeOpacity="0.16" strokeWidth="1.2" />
      <text
        x="20"
        y={label.length > 2 ? 24.4 : 25.2}
        textAnchor="middle"
        fontSize={label.length > 2 ? 12 : 14}
        fontWeight="700"
        fill="#f2f2ec"
        fontFamily="IBM Plex Sans Variable, system-ui, sans-serif"
      >
        {label}
      </text>
    </svg>
  );
}

export function MarketIcon({ code, size = 22, ring }: { code: string; size?: number | string; ring?: string }) {
  return (
    <span
      className={`mi${ring ? ' mi-ring' : ''}`}
      style={{ '--mi': typeof size === 'number' ? `${size}px` : size, '--c': ring } as React.CSSProperties}
      aria-hidden="true"
    >
      {isCountry(code) ? <img src={`/flags/${code}.svg`} alt="" draggable={false} /> : code === 'WLD' ? <Globe /> : <Region code={code} />}
    </span>
  );
}
