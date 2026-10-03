/**
 * The timezone catalogue behind the picker: every IANA zone the browser knows, with a
 * readable city name, its region, and a few search words people actually type (IST, EST…).
 */
import { cityOfZone, formatGmtOffset, isValidTimeZone, offsetMinutes } from './marketTime';

export const POPULAR = [
  'Pacific/Auckland',
  'Australia/Sydney',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Europe/Moscow',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/London',
  'UTC',
  'America/Sao_Paulo',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
] as const;

/** Extra words to find a zone by: abbreviations and country names. */
const KEYWORDS: Record<string, string> = {
  'Asia/Kolkata': 'ist india mumbai delhi bengaluru bangalore chennai calcutta',
  'America/New_York': 'est edt et eastern usa us nyc',
  'America/Chicago': 'cst cdt ct central usa us',
  'America/Denver': 'mst mdt mt mountain usa us',
  'America/Los_Angeles': 'pst pdt pt pacific usa us california san francisco',
  'Europe/London': 'gmt bst uk britain england united kingdom',
  'Europe/Berlin': 'cet cest germany frankfurt',
  'Europe/Paris': 'cet cest france',
  'Asia/Tokyo': 'jst japan',
  'Australia/Sydney': 'aest aedt australia',
  'Pacific/Auckland': 'nzst nzdt new zealand',
  'Asia/Shanghai': 'china beijing cst',
  'Asia/Singapore': 'sgt singapore',
  'Asia/Dubai': 'gst uae emirates',
  'Europe/Moscow': 'msk russia',
  'America/Sao_Paulo': 'brt brazil sao paulo',
  UTC: 'utc gmt zulu coordinated universal',
  'Asia/Hong_Kong': 'hkt hong kong',
  'Asia/Karachi': 'pkt pakistan',
  'Asia/Dhaka': 'bangladesh',
  'Asia/Kathmandu': 'nepal',
  'Africa/Johannesburg': 'sast south africa',
  'Africa/Lagos': 'wat nigeria',
  'Europe/Zurich': 'switzerland',
  'America/Toronto': 'canada eastern',
};

/** Legacy names some browsers still report, mapped to current ones. */
export const ZONE_ALIASES: Record<string, string> = {
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Asia/Rangoon': 'Asia/Yangon',
  'Europe/Kiev': 'Europe/Kyiv',
  'America/Buenos_Aires': 'America/Argentina/Buenos_Aires',
  'Etc/UTC': 'UTC',
  'Etc/GMT': 'UTC',
  GMT: 'UTC',
};

export function normaliseZone(tz: string | null | undefined): string | null {
  if (!tz) return null;
  const z = ZONE_ALIASES[tz] ?? tz;
  return isValidTimeZone(z) ? z : null;
}

export interface ZoneInfo {
  tz: string;
  city: string;
  region: string;
  offset: number;
  offsetLabel: string;
  search: string;
}

let all: string[] | null = null;

function allZones(): string[] {
  if (all) return all;
  let list: string[] = [];
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
    list = intl.supportedValuesOf?.('timeZone') ?? [];
  } catch {
    list = [];
  }
  const set = new Set<string>([...POPULAR, ...list.map((z) => ZONE_ALIASES[z] ?? z)]);
  all = [...set].filter((z) => z === 'UTC' || z.includes('/')).filter(isValidTimeZone);
  return all;
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function zoneInfo(tz: string, at: number): ZoneInfo {
  const offset = offsetMinutes(tz, at);
  const offsetLabel = formatGmtOffset(offset);
  const city = cityOfZone(tz);
  const parts = tz.split('/');
  const region = tz === 'UTC' ? 'Coordinated Universal Time' : parts.slice(0, -1).join(' · ').replace(/_/g, ' ');
  const compact = offsetLabel.replace('GMT ', ''); // "+5:30"
  const search = fold(
    [city, tz.replace(/[_/]/g, ' '), region, offsetLabel, `gmt${compact}`, `utc${compact}`, `utc ${compact}`, compact, KEYWORDS[tz] ?? ''].join(' '),
  );
  return { tz, city, region, offset, offsetLabel, search };
}

/** Matching zones for a query; with no query, the popular ones. */
export function searchZones(query: string, at: number, current: string): ZoneInfo[] {
  const q = fold(query.trim());
  if (!q) {
    const list: string[] = [...POPULAR];
    if (!list.includes(current)) list.unshift(current);
    return list.map((z) => zoneInfo(z, at)).sort((a, b) => b.offset - a.offset || a.city.localeCompare(b.city));
  }
  const words = q.split(/\s+/);
  const scored: { z: ZoneInfo; score: number }[] = [];
  for (const tz of allZones()) {
    const z = zoneInfo(tz, at);
    if (!words.every((w) => z.search.includes(w))) continue;
    const city = fold(z.city);
    let score = 3;
    if (city === q) score = 0;
    else if ((KEYWORDS[tz] ?? '').split(' ').includes(q)) score = 0.5;
    else if (city.startsWith(q)) score = 1;

    else if (city.includes(q)) score = 2;
    if ((POPULAR as readonly string[]).includes(tz)) score -= 0.5;
    scored.push({ z, score });
  }
  return scored
    .sort((a, b) => a.score - b.score || a.z.city.localeCompare(b.z.city))
    .slice(0, 60)
    .map((s) => s.z);
}
