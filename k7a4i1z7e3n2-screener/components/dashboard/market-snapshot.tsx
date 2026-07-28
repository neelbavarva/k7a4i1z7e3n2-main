import type { EconomicRecord } from '@/types/economics';
import { Card } from '@/components/ui/card';
import { compactCurrency, delta, percent } from '@/lib/formatting/numbers';

type Market = { country: string; name: string; records: EconomicRecord[] };

const accents: Record<string, string> = {
  US: '#3b82f6', IN: '#f97316', CN: '#e11d48', RU: '#a855f7',
  JP: '#ec4899', GB: '#06b6d4', WLD: '#14b8a6', Z7E: '#6366f1',
  Z4E: '#10b981', SAS: '#84cc16', LCN: '#c084fc', MEA: '#f59e0b', SSF: '#a16207',
};
const palette = ['#3b82f6', '#f97316', '#10b981', '#a855f7', '#e11d48', '#06b6d4', '#f59e0b', '#ec4899'];
const colorFor = (code: string, index = 0) => accents[code] ?? palette[index % palette.length];

function latestInRange(records: EconomicRecord[], rangeStart: number, rangeEnd: number) {
  const inRange = records.filter(r => r.year >= rangeStart && r.year <= rangeEnd);
  return [...inRange].reverse().find(r => r.gdp !== null) ?? inRange.at(-1);
}

export function MarketSnapshot({ markets, rangeStart, rangeEnd }: { markets: Market[]; rangeStart: number; rangeEnd: number }) {
  return (
    <Card className="overflow-hidden" role="region" aria-label="Market snapshot">
      <div className="flex items-center justify-between px-2.5 py-1.5"
        style={{ borderBottom: '1px solid var(--border-base)' }}
      >
        <p className="section-label text-[9px]">Selected markets</p>
        <span className="font-mono text-[9.5px] text-slate-400">latest in {rangeStart}–{rangeEnd}</span>
      </div>

      {/* Mobile: card grid */}
      <div className="grid grid-cols-1 gap-1.5 p-1.5 sm:hidden">
        {markets.map((market, index) => {
          const current = latestInRange(market.records, rangeStart, rangeEnd);
          const previous = current
            ? market.records.find(r => r.year === current.year - 1)
            : undefined;
          if (!current) return null;

          const gdpDelta    = delta(current.gdp, previous?.gdp ?? null);
          const capDelta    = delta(current.marketCap, previous?.marketCap ?? null);
          const buffDelta   = delta(current.buffettIndicator, previous?.buffettIndicator ?? null);
          const growthDelta = delta(current.gdpGrowth, previous?.gdpGrowth ?? null);

          const metricCell = (label: string, val: string, chg: number | null) => (
            <div className="rounded p-1.5" style={{ background: 'var(--surface-subtle)', border: '1px solid var(--border-base)' }}>
              <p className="section-label text-[8.5px]">{label}</p>
              <p className="metric-value mt-0.5 text-[11px] font-semibold text-slate-800">{val}</p>
              <p className={`mt-0.5 text-[9px] font-medium ${chg !== null && chg < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                {chg === null ? '—' : `${chg >= 0 ? '+' : ''}${chg.toFixed(1)}%`}
              </p>
            </div>
          );

          return (
            <article key={market.country} className="rounded-md p-2" style={{ background: 'var(--surface-card)', border: '1px solid var(--border-base)' }}>
              <div className="mb-1.5 flex items-center justify-between pb-1" style={{ borderBottom: '1px solid var(--border-base)' }}>
                <div className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: colorFor(market.country, index) }}
                    aria-hidden="true"
                  />
                  <div>
                    <h3 className="text-[11px] font-semibold text-slate-800">{market.name}</h3>
                    <span className="font-mono text-[9px] text-slate-400">Year {current.year}</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {metricCell('GDP', compactCurrency(current.gdp), gdpDelta)}
                {metricCell('Market Cap', compactCurrency(current.marketCap), capDelta)}
                {metricCell('Buffett', percent(current.buffettIndicator), buffDelta)}
                {metricCell('GDP Growth', percent(current.gdpGrowth, 1), growthDelta)}
              </div>
            </article>
          );
        })}
      </div>

      {/* Desktop: table */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead style={{ borderBottom: '1px solid var(--border-base)', background: 'var(--surface-subtle)' }}>
            <tr className="section-label text-[9px]">
              <th className="px-2.5 py-1.5 font-medium">Market</th>
              <th className="px-2.5 py-1.5 font-medium">GDP</th>
              <th className="px-2.5 py-1.5 font-medium">Market cap</th>
              <th className="px-2.5 py-1.5 font-medium">Buffett</th>
              <th className="px-2.5 py-1.5 font-medium">GDP growth</th>
            </tr>
          </thead>
          <tbody>
            {markets.map((market, index) => {
              const current  = latestInRange(market.records, rangeStart, rangeEnd);
              const previous = current ? market.records.find(r => r.year === current.year - 1) : undefined;
              if (!current) return null;

              const cell = (value: string, change: number | null) => (
                <td className="px-2.5 py-1.5">
                  <p className="metric-value text-[11.5px] font-semibold text-slate-800">{value}</p>
                  <p className={`text-[9.5px] font-medium ${change !== null && change < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {change === null ? '—' : `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`}
                  </p>
                </td>
              );

              return (
                <tr key={market.country} className="table-row-hover last:border-0"
                  style={{ borderBottom: '1px solid var(--border-base)' }}
                >
                  <td className="px-2.5 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: colorFor(market.country, index) }}
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-[11.5px] font-semibold text-slate-800">{market.name}</p>
                        <p className="font-mono text-[9.5px] text-slate-400">{current.year}</p>
                      </div>
                    </div>
                  </td>
                  {cell(compactCurrency(current.gdp), delta(current.gdp, previous?.gdp ?? null))}
                  {cell(compactCurrency(current.marketCap), delta(current.marketCap, previous?.marketCap ?? null))}
                  {cell(percent(current.buffettIndicator), delta(current.buffettIndicator, previous?.buffettIndicator ?? null))}
                  {cell(percent(current.gdpGrowth, 1), delta(current.gdpGrowth, previous?.gdpGrowth ?? null))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
