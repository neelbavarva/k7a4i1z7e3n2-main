'use client';

import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RESEARCH_MARKETS } from '@/lib/worldbank/client';

const countryCodes = new Set(['US', 'IN', 'CN', 'RU', 'JP', 'GB', 'WLD']);

interface HeaderProps {
  selectedMarkets: string[];
  onToggleMarket: (code: string) => void;
  period: number | 'MAX' | 'CUSTOM';
  onSelectPeriod: (p: number | 'MAX') => void;
  timeframeLabel: string;
  periods: ReadonlyArray<number | 'MAX'>;
  rangeStart: number;
  rangeEnd: number;
  earliestYear: number;
  latestYear: number;
  allYears: number[];
  rangeDraft: { start: string; end: string };
  onSelectRangePart: (part: 'start' | 'end', value: string) => void;
  rangeIsValid: boolean;
  rangeLabel: string;
  marketOpen: boolean;
  onMarketOpenChange: (open: boolean) => void;
  timeframeOpen: boolean;
  onTimeframeOpenChange: (open: boolean) => void;
  marketMenuRef: React.RefObject<HTMLDivElement | null>;
  timeframeRef: React.RefObject<HTMLDivElement | null>;
}

export function DashboardHeader({
  selectedMarkets,
  onToggleMarket,
  period,
  onSelectPeriod,
  timeframeLabel,
  periods,
  rangeStart,
  rangeEnd,
  earliestYear,
  latestYear,
  allYears,
  rangeDraft,
  onSelectRangePart,
  rangeIsValid,
  rangeLabel,
  marketOpen,
  onMarketOpenChange,
  timeframeOpen,
  onTimeframeOpenChange,
  marketMenuRef,
  timeframeRef,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur-md transition-colors"
      style={{ borderBottomColor: 'var(--border-base)' }}
    >
      <div className="mx-auto flex h-12 sm:h-13 max-w-[1120px] items-center justify-between gap-2 px-3">
        {/* Wordmark */}
        <a
          href="/"
          className="flex items-center gap-1.5 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
          aria-label="Kaizen Screener — home"
        >
          <span className="kaizen-wordmark text-[16px] sm:text-[17px] leading-none">
            Kaizen
          </span>
          <span className="flex h-3.5 translate-y-px items-center border-l pl-1.5 font-mono text-[10px] font-medium uppercase leading-none tracking-widest text-slate-400"
            style={{ borderLeftColor: 'var(--border-base)' }}
          >
            Screener
          </span>
        </a>

        {/* Header Controls */}
        <div className="flex items-center gap-2">
          {/* Markets Picker */}
          <div className="relative" ref={marketMenuRef}>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1 font-mono text-[11px] px-2"
              onClick={() => onMarketOpenChange(!marketOpen)}
              aria-haspopup="listbox"
              aria-expanded={marketOpen}
              aria-label={`Markets — ${selectedMarkets.length} selected`}
            >
              <span>Markets</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.2 text-[10px] font-semibold text-slate-600">
                {selectedMarkets.length}
              </span>
              <ChevronDown size={11} className={`transition-transform duration-150 text-slate-400 ${marketOpen ? 'rotate-180' : ''}`} />
            </Button>

            {marketOpen && (
              <div
                className="menu-enter absolute right-0 top-9 sm:top-8 z-40 w-60 max-w-[calc(100vw-24px)] rounded-lg p-1 shadow-lg bg-white"
                style={{
                  border: '1px solid var(--border-base)',
                }}
                role="listbox"
                aria-label="Select markets"
                aria-multiselectable="true"
              >
                {/* Country markets */}
                <div className="flex flex-col gap-0.5 rounded-md p-1" style={{ border: '1px solid var(--border-base)' }}>
                  <p className="px-1.5 py-0.5 section-label text-[9px]">Countries</p>
                  {RESEARCH_MARKETS.filter(([id]) => countryCodes.has(id)).map(([id, name]) => {
                    const isSelected = selectedMarkets.includes(id);
                    return (
                      <button
                        key={id}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => onToggleMarket(id)}
                        className={`flex min-h-[26px] w-full items-center gap-1.5 rounded px-2 py-0.5 text-left text-[11px] font-medium transition-colors ${
                          isSelected
                            ? 'bg-indigo-50 text-indigo-700 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                        {name}
                      </button>
                    );
                  })}
                </div>

                {/* Aggregates */}
                <div className="mt-1 flex flex-col gap-0.5 rounded-md p-1" style={{ border: '1px solid var(--border-base)' }}>
                  <p className="px-1.5 py-0.5 section-label text-[9px]">Regions &amp; Groups</p>
                  {RESEARCH_MARKETS.filter(([id]) => !countryCodes.has(id)).map(([id, name]) => {
                    const isSelected = selectedMarkets.includes(id);
                    return (
                      <button
                        key={id}
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => onToggleMarket(id)}
                        className={`flex min-h-[26px] w-full items-center gap-1.5 rounded px-2 py-0.5 text-left text-[11px] font-medium transition-colors ${
                          isSelected
                            ? 'bg-indigo-50 text-indigo-700 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-indigo-600' : 'bg-slate-300'}`} />
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Timeframe Picker */}
          <div className="relative" ref={timeframeRef}>
            <button
              aria-expanded={timeframeOpen}
              aria-haspopup="true"
              aria-label={`Time range: ${timeframeLabel}`}
              onClick={() => onTimeframeOpenChange(!timeframeOpen)}
              className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 font-mono text-[11px] font-medium transition-all ${
                timeframeOpen || period === 'CUSTOM'
                  ? 'border-indigo-500 bg-indigo-500 text-white shadow-2xs'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>{timeframeLabel}</span>
              <ChevronDown size={11} className={`transition-transform duration-150 ${timeframeOpen ? 'rotate-180' : 'text-slate-400'}`} />
            </button>

            {timeframeOpen && (
              <div
                className="menu-enter absolute right-0 top-9 sm:top-8 z-40 w-[260px] max-w-[calc(100vw-24px)] rounded-lg p-2.5 shadow-lg bg-white"
                style={{
                  border: '1px solid var(--border-base)',
                }}
              >
                <div className="mb-1.5 flex items-center justify-between px-0.5">
                  <span className="section-label text-[9px]">Time range</span>
                  <span className="font-mono text-[9.5px] text-slate-400">{rangeLabel}</span>
                </div>

                {/* Preset buttons */}
                <div className="grid grid-cols-4 gap-1" role="group" aria-label="Preset time ranges">
                  {periods.map(item => (
                    <button
                      key={item}
                      onClick={() => { onSelectPeriod(item); onTimeframeOpenChange(false); }}
                      aria-pressed={period === item}
                      className={`min-h-[28px] rounded border px-1 py-0.5 font-mono text-[10px] transition-colors ${
                        period === item
                          ? 'border-indigo-500 bg-indigo-500 text-white font-semibold'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {item === 'MAX' ? 'MAX' : `${item}Y`}
                    </button>
                  ))}
                </div>

                <div className="my-2 border-t border-slate-100" />

                {/* Custom range */}
                <div className="mb-1 flex items-center justify-between px-0.5">
                  <span className="section-label text-[9px]">Custom range</span>
                  <span className="font-mono text-[9px] text-slate-400">
                    {earliestYear}–{latestYear}
                  </span>
                </div>

                <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-1.5">
                  <label className="grid gap-1">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">From</span>
                    <select
                      value={rangeDraft.start || String(rangeStart)}
                      onChange={event => onSelectRangePart('start', event.target.value)}
                      className="h-7 rounded border border-slate-200 bg-white px-1 font-mono text-[10px] text-slate-700 outline-none focus:border-indigo-500"
                      aria-label="Start year"
                    >
                      {allYears.map(year => <option key={year} value={year}>{year}</option>)}
                    </select>
                  </label>
                  <span className="pb-1 text-[10px] text-slate-400">—</span>
                  <label className="grid gap-1">
                    <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">To</span>
                    <select
                      value={rangeDraft.end || String(rangeEnd)}
                      onChange={event => onSelectRangePart('end', event.target.value)}
                      className="h-7 rounded border border-slate-200 bg-white px-1 font-mono text-[10px] text-slate-700 outline-none focus:border-indigo-500"
                      aria-label="End year"
                    >
                      {allYears.map(year => <option key={year} value={year}>{year}</option>)}
                    </select>
                  </label>
                </div>

                {!rangeIsValid && (
                  <p className="mt-1.5 font-mono text-[9px] text-rose-600" role="alert">
                    End year must be on or after start year.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
