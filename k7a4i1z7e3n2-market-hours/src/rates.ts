// Exchange rates for the position size calculator, from two free, keyless APIs that allow browsers:
// - Coinbase (api.coinbase.com/v2/exchange-rates): fiat and crypto, refreshed about once a minute.
// - currency-api by fawazahmed0 (currency-api.pages.dev, mirrored on jsDelivr): one update a day, but
//   it has gold, silver, platinum and palladium, and the few currencies Coinbase lacks (CNH).
// Every rate is "units per US dollar". The last good set is kept in localStorage, so the calculator
// works straight away on the next visit and carries on offline.

import { useCallback, useEffect, useRef, useState } from 'react';
import { readStorage, writeStorage } from './hooks';
import { RATE_CODES } from './instruments';
import type { Instrument } from './instruments';

export const LIVE_URL = 'https://api.coinbase.com/v2/exchange-rates?currency=USD';
export const DAILY_URLS = [
  'https://latest.currency-api.pages.dev/v1/currencies/usd.min.json',
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.min.json',
];
export const RATES_KEY = 'tj-mh-rates';
const LIVE_EVERY = 60_000;
const DAILY_EVERY = 60 * 60_000;
const TIMEOUT = 8_000;

export type Source = 'live' | 'daily';

export interface Rate {
  /** units of the currency per US dollar */
  perUsd: number;
  source: Source;
}

export interface RateTable {
  rates: Record<string, Rate>;
  /** when the live rates were fetched (0: never) */
  liveAt: number;
  /** when the daily rates were fetched, and the date they're for */
  dailyAt: number;
  dailyDate: string | null;
}

const EMPTY: RateTable = { rates: {}, liveAt: 0, dailyAt: 0, dailyDate: null };

function loadCache(): RateTable {
  try {
    const t = JSON.parse(readStorage(RATES_KEY) || 'null') as RateTable | null;
    return t && typeof t.rates === 'object' ? t : EMPTY;
  } catch {
    return EMPTY;
  }
}

async function getJson(url: string, signal: AbortSignal): Promise<unknown> {
  const timer = new AbortController();
  const stop = () => timer.abort();
  signal.addEventListener('abort', stop);
  const id = window.setTimeout(stop, TIMEOUT);
  try {
    const res = await fetch(url, { signal: timer.signal });
    if (!res.ok) throw new Error(`${res.status}`);
    return await res.json();
  } finally {
    window.clearTimeout(id);
    signal.removeEventListener('abort', stop);
  }
}

/** Only the codes the calculator uses, upper-cased, as positive numbers. */
function pick(raw: Record<string, unknown> | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw) return out;
  for (const code of RATE_CODES) {
    const v = Number(raw[code] ?? raw[code.toLowerCase()]);
    if (Number.isFinite(v) && v > 0) out[code] = v;
  }
  return out;
}

async function fetchLive(signal: AbortSignal) {
  const body = (await getJson(LIVE_URL, signal)) as { data?: { rates?: Record<string, unknown> } };
  return pick(body.data?.rates);
}

async function fetchDaily(signal: AbortSignal) {
  let last: unknown;
  for (const url of DAILY_URLS) {
    try {
      const body = (await getJson(url, signal)) as { date?: string; usd?: Record<string, unknown> };
      return { rates: pick(body.usd), date: typeof body.date === 'string' ? body.date : null };
    } catch (e) {
      if (signal.aborted) throw e;
      last = e;
    }
  }
  throw last;
}

/**
 * The rate table, refreshed every minute while `active` and the tab is visible. Live rates win;
 * daily ones fill the gaps, and stand in for everything if Coinbase can't be reached.
 */
export function useRates(active: boolean) {
  const [table, setTable] = useState<RateTable>(loadCache);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const tableRef = useRef(table);
  tableRef.current = table;
  const busy = useRef<AbortController | null>(null);
  const triedAt = useRef(0);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    triedAt.current = Date.now();
    const ctl = new AbortController();
    busy.current = ctl;
    setLoading(true);
    const prev = tableRef.current;
    const wantDaily = Date.now() - prev.dailyAt > DAILY_EVERY;
    const [live, daily] = await Promise.allSettled([fetchLive(ctl.signal), wantDaily ? fetchDaily(ctl.signal) : Promise.reject(new Error('fresh'))]);
    if (busy.current === ctl) busy.current = null;
    if (ctl.signal.aborted) {
      if (!busy.current) setLoading(false);
      return;
    }
    setLoading(false);

    const now = Date.now();
    const rates: Record<string, Rate> = { ...prev.rates };
    // daily rates fill in, but don't replace live ones from the last 12 hours; then today's live ones go on top
    const liveRecent = now - prev.liveAt < 12 * 3_600_000;
    if (daily.status === 'fulfilled') {
      for (const [code, v] of Object.entries(daily.value.rates)) {
        if (!(liveRecent && rates[code]?.source === 'live')) rates[code] = { perUsd: v, source: 'daily' };
      }
    }
    if (live.status === 'fulfilled') for (const [code, v] of Object.entries(live.value)) rates[code] = { perUsd: v, source: 'live' };
    rates.USD = { perUsd: 1, source: 'live' };

    const next: RateTable = {
      rates,
      liveAt: live.status === 'fulfilled' ? now : prev.liveAt,
      dailyAt: daily.status === 'fulfilled' ? now : prev.dailyAt,
      dailyDate: daily.status === 'fulfilled' ? daily.value.date : prev.dailyDate,
    };
    setFailed(live.status === 'rejected');
    setTable(next);
    writeStorage(RATES_KEY, JSON.stringify(next));
  }, []);

  useEffect(() => {
    if (!active) return;
    const tick = () => {
      // once a minute, counting failed tries too, so a dead API isn't asked again every tick; a hidden
      // tab waits until it's looked at, unless it has nothing to show yet
      const last = Math.max(tableRef.current.liveAt, triedAt.current);
      const empty = !tableRef.current.liveAt && !tableRef.current.dailyAt;
      if ((!document.hidden || (empty && !triedAt.current)) && Date.now() - last >= LIVE_EVERY - 1_000) refresh();
    };
    tick();
    const id = window.setInterval(tick, 15_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
      // a request cut short doesn't count as a try: mounting again (or StrictMode's second run) asks again
      if (busy.current) {
        busy.current.abort();
        busy.current = null;
        triedAt.current = 0;
      }
    };
  }, [active, refresh]);

  return { table, loading, failed, refresh };
}

export interface Quote {
  value: number;
  /** "live" only if every rate behind it is */
  source: Source;
}

/** What one unit of `from` is worth in `to`. */
export function convert(table: RateTable, from: string, to: string): Quote | null {
  if (from === to) return { value: 1, source: 'live' };
  const a = table.rates[from];
  const b = table.rates[to];
  if (!a || !b) return null;
  return { value: b.perUsd / a.perUsd, source: a.source === 'live' && b.source === 'live' ? 'live' : 'daily' };
}

/** An instrument's price: quote currency per unit of the base. */
export const priceOf = (table: RateTable, i: Instrument) => convert(table, i.base, i.quote);
