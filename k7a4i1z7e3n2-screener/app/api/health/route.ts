import { getEconomics, DATA360_URL, REQUEST_TIMEOUT_MS, RESEARCH_MARKETS } from '@/lib/worldbank/client';
import { INDICATORS } from '@/lib/worldbank/indicators';
import { getAiCapitalFlow } from '@/lib/ai-capital-flow/provider';
import { BUBBLE_LIBRARY, CHARTED_BUBBLES } from '@/lib/bubbles/library';
import { CACHE_HOURS } from '@/lib/model';

// GET /api/health: every data source the screener uses, checked now, for the live status on
// "How the screener works". Never cached.
export const dynamic = 'force-dynamic';

type State = 'ok' | 'warn' | 'fail' | 'off';
type Check = { id: string; state: State; detail: string; ms?: number };

const time = async <T,>(task: () => Promise<T>): Promise<{ value?: T; error?: string; ms: number }> => {
  const t0 = performance.now();
  try {
    const value = await task();
    return { value, ms: Math.round(performance.now() - t0) };
  } catch (error) {
    return { error: (error as Error).message, ms: Math.round(performance.now() - t0) };
  }
};

const LABEL: Record<keyof typeof INDICATORS, string> = {
  gdp: 'GDP', realGdp: 'real GDP', gdpGrowth: 'growth', marketCap: 'market value', marketCapToGdp: 'market value % of GDP', listedCompanies: 'listed companies',
};
const RECORD_KEY: Record<keyof typeof INDICATORS, string> = {
  gdp: 'gdp', realGdp: 'realGdp', gdpGrowth: 'gdpGrowth', marketCap: 'marketCap', marketCapToGdp: 'marketCapToGdp', listedCompanies: 'listedCompanies',
};

export async function GET() {
  const checks: Check[] = [];

  // 1. the World Bank, asked directly right now (one small uncached request)
  const ping = await time(async () => {
    const params = new URLSearchParams({ DATABASE_ID: 'WB_WDI', INDICATOR: 'WB_WDI_NY_GDP_MKTP_CD', REF_AREA: 'USA', skip: '0' });
    const res = await fetch(`${DATA360_URL}?${params}`, { cache: 'no-store', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { count?: number; value?: { TIME_PERIOD: string }[] };
    const years = (json.value ?? []).map(r => Number(r.TIME_PERIOD)).filter(Number.isFinite);
    return { rows: Number(json.count) || 0, latest: years.length ? Math.max(...years) : null };
  });
  checks.push(
    ping.value
      ? { id: 'worldbank', state: ping.value.rows ? 'ok' : 'warn', detail: `Answered live: ${ping.value.rows} years of US GDP, latest ${ping.value.latest ?? 'none'}.`, ms: ping.ms }
      : { id: 'worldbank', state: 'fail', detail: `Data360 didn't answer: ${ping.error}.`, ms: ping.ms },
  );

  // 2. the data the page is built from, through the same cache the page uses
  const econ = await time(() => getEconomics());
  if (econ.value) {
    const countries = econ.value.countries;
    const withData = countries.filter(c => c.records.length).length;
    const coverage = (Object.keys(INDICATORS) as (keyof typeof INDICATORS)[])
      .map(key => {
        const n = countries.filter(c => c.records.some(r => (r as unknown as Record<string, number | null>)[RECORD_KEY[key]] != null)).length;
        return { key, n };
      });
    const thin = coverage.filter(c => c.key === 'gdp' || c.key === 'marketCap' || c.key === 'gdpGrowth').filter(c => c.n < countries.length);
    const latest = Math.max(...countries.flatMap(c => c.records.filter(r => r.gdp != null).map(r => r.year)));
    checks.push({
      id: 'economics',
      state: withData === countries.length ? (thin.length ? 'warn' : 'ok') : withData ? 'warn' : 'fail',
      detail: `${withData} of ${countries.length} markets have data, latest year ${latest}. ${coverage.map(c => `${LABEL[c.key]} ${c.n}/${countries.length}`).join(' · ')}. Kept ${CACHE_HOURS} h on the server.`,
      ms: econ.ms,
    });
  } else checks.push({ id: 'economics', state: 'fail', detail: `The page's data didn't build: ${econ.error}.`, ms: econ.ms });

  // 3. AI capital flow: the built-in OECD table, or a live feed when one is configured
  const ai = await time(() => getAiCapitalFlow());
  if (ai.value) {
    const s = ai.value.source;
    const markets = ai.value.countries.filter(c => c.records.length).length;
    const live = Boolean(process.env.OECD_AI_CAPITAL_FLOW_URL);
    checks.push({
      id: 'oecd',
      state: markets ? 'ok' : 'warn',
      detail: `${live ? 'Live feed' : 'Built-in published table'} (${s.name}): ${markets} markets, latest year ${s.latestObservationYear ?? 'none'}.`,
      ms: ai.ms,
    });
  } else checks.push({ id: 'oecd', state: 'fail', detail: `The AI feed failed: ${ai.error}. The AI view shows no data; the rest of the page is unaffected.`, ms: ai.ms });

  // 4. the bubble library, shipped with the site
  checks.push({
    id: 'bubbles',
    state: BUBBLE_LIBRARY.length ? 'ok' : 'fail',
    detail: `${BUBBLE_LIBRARY.length} episodes in the repository, ${CHARTED_BUBBLES.length} with a published path to chart.`,
  });

  return Response.json(
    { checkedAt: new Date().toISOString(), markets: RESEARCH_MARKETS.length, checks },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
