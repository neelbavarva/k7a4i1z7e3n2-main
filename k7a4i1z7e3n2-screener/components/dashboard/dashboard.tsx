'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CalendarRange, ChevronDown, Info, Maximize2, RefreshCw, RotateCcw } from 'lucide-react';
import type { AiCapitalFlowRecord, AiCapitalFlowResponse, EconomicsResponse, EconomicRecord } from '@/types/economics';
import { RESEARCH_MARKETS } from '@/lib/worldbank/client';
import { compactCurrency, delta, percent } from '@/lib/formatting/numbers';
import { Chart } from './chart';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { DataSources } from './data-sources';
import { BubbleLibrary } from './bubble-library';
import { BUBBLE_CHART_YEARS, BUBBLE_LIBRARY } from '@/lib/bubbles/library';
import { DATASET_REGISTRY } from '@/lib/datasets/registry';
import { CompatibilityEngine } from '@/lib/datasets/compatibility';
import type { DatasetMetadata } from '@/lib/datasets/metadata';
import { AnalysisEngine } from '@/lib/analysis/engine';

const periods = [1, 5, 10, 20, 30, 50, 'MAX'] as const;
const accents: Record<string, string> = { US: '#2563c8', IN: '#c65a13', CN: '#bd3f57', RU: '#7c4cb0', JP: '#a94689', GB: '#087f8c', WLD: '#0f766e', Z7E: '#5169b2', Z4E: '#197d74', SAS: '#5d8a47', LCN: '#9a5e9d', MEA: '#9a6510', SSF: '#8c5d3b' };
const palette = ['#2563c8', '#c65a13', '#197d74', '#7c4cb0', '#bd3f57', '#087f8c', '#9a6510', '#a94689'];
const BUFFETT_BAND_DEVIATIONS = 2;
const countryCodes = new Set(['US', 'IN', 'CN', 'RU', 'JP', 'GB', 'WLD']);
const colorFor = (code: string, index = 0) => accents[code] ?? palette[index % palette.length];
const marketName = (code: string) => RESEARCH_MARKETS.find(([id]) => id === code)?.[1] ?? code;

function theme() {
  return {
    textStyle: { color: '#64748b', fontFamily: '"Roboto Mono", ui-monospace, monospace' },
    animationDuration: 650,
    animationDurationUpdate: 280,
    animationEasing: 'cubicOut',
    grid: { left: 18, right: 14, top: 14, bottom: 22, containLabel: false },
    tooltip: { trigger: 'axis', transitionDuration: 0, backgroundColor: '#ffffff', borderColor: '#d7dee9', borderWidth: 1, textStyle: { color: '#172033', fontSize: 10, fontFamily: '"Roboto Mono", ui-monospace, monospace' }, extraCssText: 'box-shadow:0 12px 30px rgba(15,23,42,.12); border-radius:8px', padding: 10, axisPointer: { type: 'line', snap: true, lineStyle: { color: '#94a3b8', type: 'dashed' } } },
    dataZoom: [{ type: 'inside', filterMode: 'none', throttle: 50, zoomOnMouseWheel: true, moveOnMouseMove: true, moveOnMouseWheel: true }],
    xAxis: { type: 'category', boundaryGap: false, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#475569', fontSize: 8, fontFamily: '"Roboto Mono", ui-monospace, monospace', hideOverlap: true, margin: 4 }, splitLine: { show: true, lineStyle: { color: '#f1f5f9', type: 'dashed' } } },
    yAxis: { type: 'value', scale: true, splitLine: { show: true, lineStyle: { color: '#f1f5f9', type: 'dashed' } }, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#475569', fontSize: 7, fontFamily: '"Roboto Mono", ui-monospace, monospace', width: 14, align: 'right', overflow: 'truncate', margin: 2 } }
  } as const;
}

function latest(records: EconomicRecord[]) {
  return [...records].reverse().find(record => record.gdp !== null) ?? records.at(-1);
}

function MarketSnapshot({ markets }: { markets: { country: string; name: string; records: EconomicRecord[] }[] }) {
  return <Card className="overflow-hidden">
    <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
      <p className="font-mono text-[10px] font-medium uppercase tracking-[.1em] text-slate-500">Selected markets</p>
      <span className="font-mono text-[10px] text-slate-400">latest in selected range</span>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead className="border-b border-slate-100 bg-slate-50/70"><tr className="font-mono text-[10px] uppercase tracking-[.08em] text-slate-400"><th className="px-3 py-2 font-medium">Market</th><th className="px-3 py-2 font-medium">GDP</th><th className="px-3 py-2 font-medium">Market cap</th><th className="px-3 py-2 font-medium">Buffett</th><th className="px-3 py-2 font-medium">GDP growth</th></tr></thead>
        <tbody>{markets.map((market, index) => {
          const current = latest(market.records);
          const previous = current ? market.records.find(record => record.year === current.year - 1) : undefined;
          if (!current) return null;
          const cell = (value: string, change: number | null) => <td className="px-3 py-2"><p className="metric-value text-sm font-semibold text-slate-800">{value}</p><p className={`mt-0.5 text-[10px] font-medium ${change !== null && change < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{change === null ? '—' : `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`}</p></td>;
          return <tr key={market.country} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"><td className="px-3 py-2"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorFor(market.country, index) }} /><div><p className="text-xs font-semibold text-slate-800">{market.name}</p><p className="font-mono text-[10px] text-slate-400">{current.year}</p></div></div></td>{cell(compactCurrency(current.gdp), delta(current.gdp, previous?.gdp ?? null))}{cell(compactCurrency(current.marketCap), delta(current.marketCap, previous?.marketCap ?? null))}{cell(percent(current.buffettIndicator), delta(current.buffettIndicator, previous?.buffettIndicator ?? null))}{cell(percent(current.gdpGrowth, 1), delta(current.gdpGrowth, previous?.gdpGrowth ?? null))}</tr>;
        })}</tbody>
      </table>
    </div>
  </Card>;
}

function ChartPanel({ title, subtitle, option, height, toolbar, legend }: { title: string; subtitle: string; option: Record<string, unknown>; height?: string; toolbar?: React.ReactNode; legend?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [expandedResetKey, setExpandedResetKey] = useState(0);
  return <><Card className="soft-enter overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-3 py-2"><div className="min-w-0"><h2 className="text-xs font-semibold text-slate-800">{title}</h2><p className="mt-0.5 text-[10px] text-slate-400">{subtitle}</p></div><div className="flex items-center gap-2">{toolbar}<Button variant="outline" size="sm" onClick={() => setResetKey(key => key + 1)} className="h-7 shrink-0 gap-1 px-2 text-[11px]" title="Reset chart view"><RotateCcw size={12} />Reset</Button><Button variant="outline" size="sm" onClick={() => setOpen(true)} className="h-7 shrink-0 gap-1 px-2 text-[11px]"><Maximize2 size={12} />Expand</Button></div></div>{legend && <div className="border-b border-slate-100 bg-slate-50/40 px-3 py-1.5">{legend}</div>}<div className="p-1"><Chart option={option} className={height} resetKey={resetKey} /></div></Card><Dialog open={open} onOpenChange={setOpen} title={title} actions={<Button variant="outline" size="sm" onClick={() => setExpandedResetKey(key => key + 1)} className="h-7 shrink-0 gap-1 px-2 text-[11px]" title="Reset chart view"><RotateCcw size={12} />Reset</Button>}><Chart option={option} className="h-[calc(100dvh-72px)]" resetKey={expandedResetKey} /></Dialog></>;
}

export function Dashboard({ initialData, initialAiCapitalFlow = null }: { initialData: EconomicsResponse | null; initialAiCapitalFlow?: AiCapitalFlowResponse | null }) {
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>(['US', 'WLD']);
  const [marketOpen, setMarketOpen] = useState(false);
  const [period, setPeriod] = useState<number | 'MAX' | 'CUSTOM'>(10);
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [rangeDraft, setRangeDraft] = useState({ start: '', end: '' });
  const [timeframeOpen, setTimeframeOpen] = useState(false);
  const [selectedModes, setSelectedModes] = useState<Set<string>>(new Set(['gdp']));
  const [aiMode, setAiMode] = useState<'intensity' | 'flow'>('intensity');
  const marketMenuRef = useRef<HTMLDivElement>(null);
  const timeframeRef = useRef<HTMLDivElement>(null);
  const data = initialData?.countries ?? [];
  const allYears = useMemo(() => Array.from(new Set(data.filter(country => selectedMarkets.includes(country.country)).flatMap(country => country.records.map(record => record.year)))).sort((a, b) => a - b), [data, selectedMarkets]);
  const earliestYear = allYears.at(0) ?? new Date().getFullYear();
  const latestYear = allYears.at(-1) ?? earliestYear;
  const parseYear = (value: string, fallback: number) => { const year = Number(value); return Number.isInteger(year) && allYears.includes(year) ? year : fallback; };
  const selectedStart = period === 'CUSTOM' ? parseYear(customRange.start, earliestYear) : period === 'MAX' ? earliestYear : Math.max(earliestYear, latestYear - period + 1);
  const selectedEnd = period === 'CUSTOM' ? parseYear(customRange.end, latestYear) : latestYear;
  const rangeStart = Math.min(selectedStart, selectedEnd);
  const rangeEnd = Math.max(selectedStart, selectedEnd);
  const rangeLabel = `${rangeStart}–${rangeEnd}`;
  const draftStart = parseYear(rangeDraft.start, rangeStart);
  const draftEnd = parseYear(rangeDraft.end, rangeEnd);
  const rangeIsValid = Boolean(rangeDraft.start && rangeDraft.end) && draftStart <= draftEnd;
  const toggleTimeframe = () => { if (!timeframeOpen) setRangeDraft({ start: String(rangeStart), end: String(rangeEnd) }); setTimeframeOpen(open => !open); };
  const selectRangePart = (part: 'start' | 'end', value: string) => { const next = { ...rangeDraft, [part]: value }; setRangeDraft(next); if (next.start && next.end && Number(next.start) <= Number(next.end)) { setCustomRange(next); setPeriod('CUSTOM'); } };
  const visible = useMemo(() => data.filter(country => selectedMarkets.includes(country.country)).map(country => ({ ...country, records: country.records.filter(record => record.year >= rangeStart && record.year <= rangeEnd) })), [data, selectedMarkets, rangeStart, rangeEnd]);
  const aiVisible = useMemo(() => selectedMarkets.map(country => {
    const dataset = initialAiCapitalFlow?.countries.find(item => item.country === country);
    return { country, name: dataset?.name ?? marketName(country), records: (dataset?.records ?? []).filter(record => record.year >= rangeStart && record.year <= rangeEnd) };
  }), [initialAiCapitalFlow, selectedMarkets, rangeStart, rangeEnd]);


  const years = useMemo(() => allYears.filter(year => year >= rangeStart && year <= rangeEnd), [allYears, rangeStart, rangeEnd]);

  const aiYears = useMemo(() => {
    const observed = aiVisible.flatMap(market => market.records
      .filter(record => record.aiInvestment !== null || record.aiVentureCapitalInvestment !== null)
      .map(record => record.year));
    if (!observed.length) return years;
    const first = Math.min(...observed);
    const last = Math.max(...observed);
    return years.filter(year => year >= first && year <= last);
  }, [aiVisible, years]);

  const valuesFor = (market: typeof visible[number], metric: keyof EconomicRecord) => { const byYear = new Map(market.records.map(record => [record.year, record])); return years.map(year => { const value = byYear.get(year)?.[metric]; return typeof value === 'number' ? value : null; }); };
  const aiValuesFor = (market: typeof aiVisible[number], metric: keyof AiCapitalFlowRecord) => { const byYear = new Map(market.records.map(record => [record.year, record])); return aiYears.map(year => { const value = byYear.get(year)?.[metric]; return typeof value === 'number' ? value : null; }); };
  const aiIntensityFor = (market: typeof aiVisible[number]) => aiYears.map(year => {
    const flow = market.records.find(record => record.year === year)?.aiInvestment ?? market.records.find(record => record.year === year)?.aiVentureCapitalInvestment ?? null;
    const gdp = visible.find(item => item.country === market.country)?.records.find(record => record.year === year)?.gdp ?? null;
    return flow !== null && gdp !== null && gdp > 0 ? (flow / gdp) * 100 : null;
  });

  const toggleMarket = (market: string) => setSelectedMarkets(current => current.includes(market) ? (current.length === 1 ? current : current.filter(code => code !== market)) : [...current, market]);
  const toggleMode = (modeId: string) => {
    setSelectedModes((prev) => {
      const next = new Set(prev);
      if (next.has(modeId)) {
        if (next.size > 1) next.delete(modeId);
      } else {
        next.add(modeId);
      }
      return next;
    });
  };

  useEffect(() => { const closeOnOutsideClick = (event: MouseEvent) => { const target = event.target as Node; if (marketMenuRef.current && !marketMenuRef.current.contains(target)) setMarketOpen(false); if (timeframeRef.current && !timeframeRef.current.contains(target)) setTimeframeOpen(false); }; document.addEventListener('mousedown', closeOnOutsideClick); return () => document.removeEventListener('mousedown', closeOnOutsideClick); }, []);

  const rollingBand = (values: (number | null)[]) => values.map((_, index) => { const set = values.slice(Math.max(0, index - 9), index + 1).filter((value): value is number => value !== null); if (!set.length) return { mean: null, lower: null, range: null }; const mean = set.reduce((sum, value) => sum + value, 0) / set.length; const variance = set.reduce((sum, value) => sum + (value - mean) ** 2, 0) / set.length; const deviation = Math.sqrt(variance) * BUFFETT_BAND_DEVIATIONS; return { mean, lower: Math.max(0, mean - deviation), range: deviation * 2 }; });
  const timeAxis = () => ({ ...theme().xAxis, data: years.map(String), axisLabel: { ...theme().xAxis.axisLabel, formatter: (value: string, index: number) => index === 0 ? '' : value } });
  const aiTimeAxis = () => ({ ...theme().xAxis, data: aiYears.map(String), axisLabel: { ...theme().xAxis.axisLabel, formatter: (value: string, index: number) => index === 0 ? '' : value } });

  const indexed = (values: (number | null)[]) => { const base = values.find((value): value is number => value !== null && value > 0); return values.map(value => base && value !== null ? (value / base) * 100 : null); };

  const isMulti = selectedModes.size > 1;

  // Single-mode helpers matching original presets
  const lineOption = (metric: keyof EconomicRecord, unit: '$' | '%', guides = false) => ({
    ...theme(),
    tooltip: { ...theme().tooltip, formatter: (items: { axisValueLabel?: string; marker?: string; seriesName?: string; value?: unknown }[]) => { const rows = (Array.isArray(items) ? items : []).filter(item => item.seriesName); const label = rows[0]?.axisValueLabel ?? ''; return [`<strong>${label}</strong>`, ...rows.map(item => { const value = typeof item.value === 'number' ? item.value : Number(item.value); const display = unit === '$' ? `$${(value / 1e12).toFixed(2)}T` : `${value.toFixed(1)}%`; return `${item.marker ?? ''}${item.seriesName} <strong>${display}</strong>`; })].join('<br/>'); } },
    xAxis: timeAxis(),
    yAxis: { ...theme().yAxis, axisLabel: { ...theme().yAxis.axisLabel, formatter: (value: number) => metric === 'gdp' && value === 0 ? '' : unit === '$' ? `${Math.round(value / 1e12)}` : `${value}%` } },
    legend: { show: false },
    series: visible.flatMap((market, index) => {
      const values = valuesFor(market, metric);
      const band = rollingBand(values);
      const color = colorFor(market.country, index);
      const raw = { bandOwner: `buffett-${market.country}`, name: market.name, type: 'line', smooth: 0.32, smoothMonotone: 'x', connectNulls: false, showSymbol: false, lineStyle: { width: 2.6, color }, itemStyle: { color }, areaStyle: { opacity: .045 }, emphasis: { focus: 'series', lineStyle: { width: 3.3 } }, data: values, markLine: guides ? { silent: true, symbol: 'none', lineStyle: { color: '#94a3b8', type: 'dashed', width: 1 }, label: { show: false }, data: [{ yAxis: 100 }] } : undefined };
      if (!guides) return [raw];
      return [
        raw,
        { bandOwner: `buffett-${market.country}`, name: '', type: 'line', stack: `band-${market.country}`, showSymbol: false, data: band.map(point => point.lower), lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 }, silent: true, tooltip: { show: false } },
        { bandOwner: `buffett-${market.country}`, name: '', type: 'line', stack: `band-${market.country}`, showSymbol: false, data: band.map(point => point.range), lineStyle: { opacity: 0 }, areaStyle: { color, opacity: .18 }, silent: true, tooltip: { show: false } },
        { bandOwner: `buffett-${market.country}`, name: '', type: 'line', smooth: 0.4, smoothMonotone: 'x', showSymbol: false, data: band.map(point => point.mean), lineStyle: { color, width: 1.5, type: 'dashed', opacity: .85 }, silent: true, tooltip: { show: false } }
      ];
    })
  });

  const growthOption = { ...theme(), xAxis: timeAxis(), yAxis: { ...theme().yAxis, axisLabel: { ...theme().yAxis.axisLabel, formatter: '{value}%' } }, legend: { show: false }, series: visible.map((market, index) => ({ name: market.name, type: 'bar', barMaxWidth: 16, itemStyle: { color: colorFor(market.country, index), borderRadius: [3, 3, 0, 0] }, data: valuesFor(market, 'gdpGrowth'), markLine: index === 0 ? { silent: true, symbol: 'none', lineStyle: { color: '#64748b', width: 1.25, type: 'solid', opacity: .82 }, label: { show: false }, data: [{ yAxis: 0 }] } : undefined })) };
  const relativeOption = { ...theme(), xAxis: timeAxis(), yAxis: { ...theme().yAxis, axisLabel: { ...theme().yAxis.axisLabel, formatter: '{value}' } }, legend: { show: false }, series: visible.flatMap((market, index) => { const color = colorFor(market.country, index); return [{ name: `${market.name} GDP`, type: 'line', smooth: 0.32, showSymbol: false, data: indexed(valuesFor(market, 'gdp')), lineStyle: { color, width: 2.6 }, areaStyle: { opacity: .035 } }, { name: `${market.name} market cap`, type: 'line', smooth: 0.32, showSymbol: false, data: indexed(valuesFor(market, 'marketCap')), lineStyle: { color, width: 2, type: 'dashed' } }]; }) };
  const scatterOption = { ...theme(), xAxis: { type: 'value', name: 'GDP growth', nameTextStyle: { color: '#64748b', fontSize: 9, fontFamily: '"Roboto Mono", ui-monospace, monospace' }, axisLabel: { formatter: '{value}%', color: '#64748b', fontSize: 9, fontFamily: '"Roboto Mono", ui-monospace, monospace' }, splitLine: { lineStyle: { color: '#e7edf4' } } }, yAxis: { type: 'value', name: 'Buffett Indicator', nameTextStyle: { color: '#64748b', fontSize: 9, fontFamily: '"Roboto Mono", ui-monospace, monospace' }, axisLabel: { formatter: '{value}%', color: '#64748b', fontSize: 9, fontFamily: '"Roboto Mono", ui-monospace, monospace' }, splitLine: { lineStyle: { color: '#e7edf4' } } }, series: visible.map((market, index) => ({ name: market.name, type: 'scatter', symbolSize: 9, itemStyle: { color: colorFor(market.country, index), opacity: .82 }, data: market.records.filter(record => record.gdpGrowth !== null && record.buffettIndicator !== null).map(record => [record.gdpGrowth, record.buffettIndicator]) })) };
  const rollingFiveYear = (values: (number | null)[]) => values.map((_, index) => { const window = values.slice(Math.max(0, index - 4), index + 1).filter((value): value is number => value !== null); return window.length === 5 ? window.reduce((sum, value) => sum + value, 0) / window.length : null; });
  const aiRawCapitalOption = { ...theme(), tooltip: { ...theme().tooltip, formatter: (items: { axisValueLabel?: string; marker?: string; seriesName?: string; value?: unknown }[]) => { const rows = (Array.isArray(items) ? items : []).filter(item => item.seriesName && typeof item.value === 'number'); const label = rows[0]?.axisValueLabel ?? ''; return [`<strong>${label}</strong>`, ...rows.map(item => `${item.marker ?? ''}${item.seriesName} <strong>${compactCurrency(item.value as number)}</strong>`)].join('<br/>'); } }, xAxis: aiTimeAxis(), yAxis: { ...theme().yAxis, axisLabel: { ...theme().yAxis.axisLabel, formatter: (value: number) => value === 0 ? '' : `$${value >= 1e9 ? `${(value / 1e9).toFixed(0)}B` : `${(value / 1e6).toFixed(0)}M`}` } }, legend: { show: false }, series: aiVisible.map((market, index) => ({ name: `${market.name} · AI VC`, type: 'line', smooth: false, connectNulls: false, showSymbol: true, symbolSize: 5, data: aiValuesFor(market, 'aiVentureCapitalInvestment'), lineStyle: { width: 2.2, color: colorFor(market.country, index), type: 'dashed' }, itemStyle: { color: colorFor(market.country, index) }, emphasis: { focus: 'series', lineStyle: { width: 3 } } })) };
  const aiIntensityOption = { ...theme(), tooltip: { ...theme().tooltip, formatter: (items: { axisValueLabel?: string; marker?: string; seriesName?: string; value?: unknown }[]) => { const rows = (Array.isArray(items) ? items : []).filter(item => item.seriesName && typeof item.value === 'number' && !item.seriesName.includes('5Y baseline')); const label = rows[0]?.axisValueLabel ?? ''; return [`<strong>${label}</strong>`, ...rows.map(item => `${item.marker ?? ''}${item.seriesName} <strong>${((item.value as number) * 100).toFixed(1)} bps of GDP</strong>`)].join('<br/>'); } }, xAxis: aiTimeAxis(), yAxis: { ...theme().yAxis, axisLabel: { ...theme().yAxis.axisLabel, formatter: (value: number) => `${value.toFixed(2)}%` } }, legend: { show: false }, series: aiVisible.flatMap((market, index) => { const values = aiIntensityFor(market); const color = colorFor(market.country, index); return [
    { name: `${market.name} · AI VC / GDP`, type: 'line', smooth: false, connectNulls: false, showSymbol: true, symbolSize: 5, data: values, lineStyle: { width: 2.4, color }, itemStyle: { color }, areaStyle: { color, opacity: .035 }, emphasis: { focus: 'series', lineStyle: { width: 3.1 } } },
    { name: `${market.name} · 5Y baseline`, type: 'line', smooth: false, connectNulls: false, showSymbol: false, data: rollingFiveYear(values), lineStyle: { width: 1.4, color, type: 'dashed', opacity: .7 }, silent: true, tooltip: { show: false } }
  ]; }) };
  const aiCapitalOption = aiMode === 'intensity' ? aiIntensityOption : aiRawCapitalOption;
  const bubbleChartOption = {
    ...theme(),
    xAxis: { ...theme().xAxis, data: BUBBLE_CHART_YEARS.map(String), axisLabel: { ...theme().xAxis.axisLabel, formatter: (value: string, index: number) => index === 0 ? '' : value } },
    yAxis: { ...theme().yAxis, axisLabel: { ...theme().yAxis.axisLabel, formatter: (value: number) => `${Math.round(value)}` } },
    legend: { show: false },
    series: BUBBLE_LIBRARY.filter(bubble => bubble.chart && bubble.chart.points.length > 1).map((bubble, index) => {
      const pointByYear = new Map(bubble.chart?.points.map(point => [point.year, point.value]));
      const color = palette[index % palette.length];
      return {
        name: `${bubble.name} · peak = 100`, type: 'line', smooth: false, connectNulls: false, showSymbol: true, symbolSize: 4,
        data: BUBBLE_CHART_YEARS.map(year => pointByYear.get(year) ?? null), lineStyle: { width: 2.3, color }, itemStyle: { color }, areaStyle: { color, opacity: .035 }, emphasis: { focus: 'series', lineStyle: { width: 3 } }
      };
    })
  };

  // Metadata-driven Active Datasets Resolution
  const activeDatasetMetadatas = useMemo(() => {
    const list: DatasetMetadata[] = [];
    selectedModes.forEach(modeId => {
      if (modeId === 'gdp') list.push(DATASET_REGISTRY.gdp);
      else if (modeId === 'market-cap') list.push(DATASET_REGISTRY.marketCap);
      else if (modeId === 'buffett') list.push(DATASET_REGISTRY.buffett);
      else if (modeId === 'growth') list.push(DATASET_REGISTRY.gdpGrowth);
      else if (modeId === 'ai-capital') list.push(DATASET_REGISTRY.aiInvestment);
      else if (modeId === 'valuation') list.push(DATASET_REGISTRY.valuation);
      else if (modeId === 'bubbles') list.push(DATASET_REGISTRY.bubbles);
      else if (modeId === 'relative') list.push(DATASET_REGISTRY.gdp, DATASET_REGISTRY.marketCap);
    });
    return list;
  }, [selectedModes]);

  // Composable Multi-Mode Option Builder driven by Dataset Metadata
  const multiOption = useMemo(() => {
    if (!isMulti) return null;
    const containsValuation = selectedModes.has('valuation');
    if (containsValuation) return scatterOption;

    const seriesList: Record<string, unknown>[] = [];
    const nonBubbleDatasets = activeDatasetMetadatas.filter(d => d.id !== 'bubbles');

    if (nonBubbleDatasets.length > 0) {
      visible.forEach((market, index) => {
        const color = colorFor(market.country, index);
        const marketSeries = CompatibilityEngine.buildSeriesForMarket(
          market,
          nonBubbleDatasets,
          years,
          color,
          visible,
          aiVisible,
          aiYears
        );
        seriesList.push(...(marketSeries as unknown as Record<string, unknown>[]));
      });
    }

    if (selectedModes.has('bubbles')) {
      BUBBLE_LIBRARY.filter(bubble => bubble.chart && bubble.chart.points.length > 1).forEach((bubble, index) => {
        const pointByYear = new Map(bubble.chart?.points.map(point => [point.year, point.value]));
        const color = palette[index % palette.length];
        seriesList.push({
          name: `${bubble.name} · peak = 100`, type: 'line', smooth: false, connectNulls: false, showSymbol: true, symbolSize: 4,
          data: BUBBLE_CHART_YEARS.map(year => pointByYear.get(year) ?? null), lineStyle: { width: 2.3, color }, itemStyle: { color }
        });
      });
    }

    return {
      ...theme(),
      xAxis: timeAxis(),
      yAxis: { ...theme().yAxis, axisLabel: { ...theme().yAxis.axisLabel, formatter: '{value}' } },
      series: seriesList,
    };
  }, [selectedModes, isMulti, visible, aiVisible, activeDatasetMetadatas, years, aiYears]);

  const views = [
    { id: 'gdp', label: 'GDP', title: 'GDP over time', subtitle: 'Nominal GDP · current US dollars', option: lineOption('gdp', '$') },
    { id: 'market-cap', label: 'Market cap', title: 'Stock market capitalization', subtitle: 'Listed domestic companies · current US dollars', option: lineOption('marketCap', '$') },
    { id: 'buffett', label: 'Buffett', title: 'Market capitalization relative to GDP', subtitle: 'Market cap ÷ GDP · reference lines are context only', option: lineOption('buffettIndicator', '%', true) },
    { id: 'relative', label: 'Relative', title: 'GDP versus market cap', subtitle: 'Indexed to first complete year = 100 · solid GDP / dashed market cap', option: relativeOption },
    { id: 'growth', label: 'Growth', title: 'GDP growth', subtitle: 'Annual real GDP growth', option: growthOption },
    { id: 'ai-capital', label: 'AI flow', title: aiMode === 'intensity' ? 'AI capital intensity' : 'AI venture-capital flow', subtitle: aiMode === 'intensity' ? 'AI VC as a share of GDP · observed annual points with 5Y baseline' : 'Observed annual AI VC investment · no interpolated values', option: aiCapitalOption },
    { id: 'bubbles', label: 'Bubbles', title: 'Historical bubble library', subtitle: 'Source-backed benchmark reference paths · independent of market and timeframe filters', option: bubbleChartOption },
    { id: 'valuation', label: 'Valuation', title: 'Valuation versus economic growth', subtitle: 'Each point represents one year', option: scatterOption }
  ];

  const singleActiveId = selectedModes.size === 1 ? Array.from(selectedModes)[0] : null;
  const currentView = singleActiveId ? (views.find(v => v.id === singleActiveId) ?? views[0]) : {
    id: 'multi',
    title: 'Macro Research Terminal',
    subtitle: `Multi-dataset view (${Array.from(selectedModes).map(id => views.find(v => v.id === id)?.label ?? id).join(', ')})`,
    option: multiOption ?? views[0].option
  };

  const axisHint = CompatibilityEngine.generateAxisHint(activeDatasetMetadatas);

  const marketBadges = visible.map((market, index) => {
    const color = colorFor(market.country, index);
    const statuses = activeDatasetMetadatas
      .map(dataset => {
        let vals: (number | null)[] = [];
        if (dataset.id === 'gdp') vals = valuesFor(market, 'gdp');
        else if (dataset.id === 'marketCap') vals = valuesFor(market, 'marketCap');
        else if (dataset.id === 'buffett') vals = valuesFor(market, 'buffettIndicator');
        else if (dataset.id === 'gdpGrowth') vals = valuesFor(market, 'gdpGrowth');
        else if (dataset.id === 'aiInvestment') {
          const aiMarket = aiVisible.find(item => item.country === market.country);
          vals = aiMarket ? aiValuesFor(aiMarket, 'aiVentureCapitalInvestment') : [];
        }
        if (!vals.length) return null;
        const result = AnalysisEngine.analyze(dataset, vals, market.country);
        return `${dataset.shortName}: ${result.statusLabel}`;
      })
      .filter((s): s is string => Boolean(s));

    const statusText = statuses.length ? ` (${statuses.join(' · ')})` : '';

    return (
      <span key={market.country} className="inline-flex h-6 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-medium text-slate-700">
        <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: color, border: `1px solid ${color}` }} />
        {market.name}
        {statusText && <span className="font-mono text-[9px] text-slate-500">{statusText}</span>}
      </span>
    );
  });
  const marketLegend = <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-nowrap sm:items-start"><div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{marketBadges}</div><div className="flex shrink-0 items-center sm:justify-end"><span className="inline-flex h-6 whitespace-nowrap items-center rounded-md border border-slate-200 bg-white px-2 font-mono text-[10px] text-slate-500">{axisHint}</span></div></div>;
  const relativeLegend = <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-nowrap sm:items-start"><div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"><span className="inline-flex h-6 items-center rounded-md border border-slate-200 bg-white px-2 text-[10px] text-slate-600">solid GDP · patterned market cap</span>{visible.map((market, index) => { const color = colorFor(market.country, index); return <span key={market.country} className="inline-flex h-6 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-medium text-slate-700"><span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: color, border: `1px solid ${color}` }} /><span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: `${color}24`, border: `1px solid ${color}`, backgroundImage: `repeating-linear-gradient(-45deg, transparent 0 2px, ${color} 2px 3px)` }} />{market.name}</span>; })}</div><div className="flex shrink-0 items-center sm:justify-end"><span className="inline-flex h-6 whitespace-nowrap items-center rounded-md border border-slate-200 bg-white px-2 font-mono text-[10px] text-slate-500">{axisHint}</span></div></div>;
  const aiLegend = <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-nowrap sm:items-start"><div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"><span className="inline-flex h-6 items-center rounded-md border border-slate-200 bg-white px-2 text-[10px] text-slate-600">{aiMode === 'intensity' ? 'observed AI VC / GDP · dashed 5Y baseline' : 'observed annual AI VC · no interpolation'}</span>{aiVisible.map((market, index) => { const color = colorFor(market.country, index); return <span key={market.country} className="inline-flex h-6 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-medium text-slate-700"><span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: color, border: `1px solid ${color}` }} />{market.name}</span>; })}</div><div className="flex shrink-0 items-center gap-1 sm:justify-end"><div className="flex h-6 items-center rounded-md border border-slate-200 bg-slate-50 p-0.5"><button onClick={() => setAiMode('intensity')} className={`h-5 rounded px-1.5 font-mono text-[9px] ${aiMode === 'intensity' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>AI / GDP</button><button onClick={() => setAiMode('flow')} className={`h-5 rounded px-1.5 font-mono text-[9px] ${aiMode === 'flow' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>Raw VC</button></div><span className="inline-flex h-6 whitespace-nowrap items-center rounded-md border border-slate-200 bg-white px-2 font-mono text-[10px] text-slate-500">{axisHint}</span></div></div>;
  const bubbleLegend = <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-nowrap sm:items-start"><div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"><span className="inline-flex h-6 items-center rounded-md border border-slate-200 bg-white px-2 text-[10px] text-slate-600">source observations · each benchmark normalized to peak = 100</span>{BUBBLE_LIBRARY.filter(bubble => bubble.chart).map((bubble, index) => <span key={bubble.id} className="inline-flex h-6 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-medium text-slate-700"><span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: palette[index % palette.length], border: `1px solid ${palette[index % palette.length]}` }} />{bubble.name}</span>)}</div><div className="flex shrink-0 items-center sm:justify-end"><span className="inline-flex h-6 whitespace-nowrap items-center rounded-md border border-slate-200 bg-white px-2 font-mono text-[10px] text-slate-500">{axisHint}</span></div></div>;

  const aiMetrics = aiVisible.map((market, index) => {
    const current = [...market.records].reverse().find(record => record.aiInvestment !== null || record.aiVentureCapitalInvestment !== null);
    const gdp = current ? visible.find(item => item.country === market.country)?.records.find(record => record.year === current.year)?.gdp ?? null : null;
    const currentFlow = current?.aiInvestment ?? current?.aiVentureCapitalInvestment ?? null;
    const baseRecord = current ? market.records.find(record => record.year === current.year - 5) : undefined;
    const base = baseRecord?.aiInvestment ?? baseRecord?.aiVentureCapitalInvestment ?? null;
    const cagr = currentFlow !== null && base !== null && base > 0 ? ((currentFlow / base) ** (1 / 5) - 1) * 100 : null;
    return { market, index, current, aiToGdp: currentFlow !== null && gdp ? (currentFlow / gdp) * 100 : null, cagr };
  });
  const hasAiObservations = aiVisible.some(market => market.records.some(record => record.aiInvestment !== null || record.aiVentureCapitalInvestment !== null));

  if (!initialData) return <main className="grid min-h-screen place-items-center bg-slate-50 text-center"><div><AlertCircle className="mx-auto mb-3 text-red-600" /><p className="font-medium">Unable to load economic data.</p><button onClick={() => location.reload()} className="mt-4 inline-flex items-center gap-2 border border-slate-300 bg-white px-3 py-2 text-sm"><RefreshCw size={14} />Retry</button></div></main>;

  const timeframeLabel = period === 'CUSTOM' ? rangeLabel : period === 'MAX' ? 'MAX' : `${period}Y`;
  const activeLegend = isMulti
    ? marketLegend
    : singleActiveId === 'relative' ? relativeLegend
    : singleActiveId === 'ai-capital' ? aiLegend
    : singleActiveId === 'bubbles' ? bubbleLegend
    : marketLegend;

  return <main className="light-ui min-h-screen bg-[#fafbfc]">
    <header className="sticky top-0 z-30"><div className="mx-auto flex min-h-14 max-w-[1120px] flex-wrap items-center gap-2 px-3 py-2">
      <div className="mr-auto flex items-center gap-1.5" aria-label="Kaizen Screener"><span className="kaizen-wordmark text-[17px] leading-none text-slate-900">Kaizen</span><span className="flex h-4 translate-y-px items-center border-l border-slate-200 pl-1.5 font-mono text-[10px] font-medium uppercase leading-none tracking-[.12em] text-slate-500">Screener</span></div>
      <div className="relative" ref={marketMenuRef}><Button variant="outline" size="sm" className="gap-1.5 font-mono" onClick={() => setMarketOpen(open => !open)}>Markets <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px]">{selectedMarkets.length}</span><ChevronDown size={13} /></Button>{marketOpen && <div className="menu-enter absolute right-0 top-9 z-40 w-64 rounded-md border border-slate-200 bg-white p-1.5 shadow-lg"><div className="flex flex-col gap-1 rounded-md border border-[#d6deeb] p-1">{RESEARCH_MARKETS.filter(([id]) => countryCodes.has(id)).map(([id, name]) => <button key={id} onClick={() => toggleMarket(id)} className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${selectedMarkets.includes(id) ? 'bg-[#465d86] text-white hover:bg-[#394e73]' : 'text-slate-700 hover:bg-[#f6f8fc]'}`}><span className={`h-1.5 w-1.5 rounded-full ${selectedMarkets.includes(id) ? 'bg-white/80' : 'bg-[#465d86]'}`} />{name}</button>)}</div><div className="mt-1.5 flex flex-col gap-1 rounded-md border border-[#d9e3ce] p-1">{RESEARCH_MARKETS.filter(([id]) => !countryCodes.has(id)).map(([id, name]) => <button key={id} onClick={() => toggleMarket(id)} className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${selectedMarkets.includes(id) ? 'bg-[#5d7847] text-white hover:bg-[#4e673b]' : 'text-slate-700 hover:bg-[#f7faf4]'}`}><span className={`h-1.5 w-1.5 rounded-full ${selectedMarkets.includes(id) ? 'bg-white/80' : 'bg-[#5d7847]'}`} />{name}</button>)}</div></div>}</div>
      <div className="relative" ref={timeframeRef}>
        <button aria-expanded={timeframeOpen} onClick={toggleTimeframe} className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 font-mono text-[11px] transition-colors ${timeframeOpen || period === 'CUSTOM' ? 'border-[#5b6fc9] bg-[#5b6fc9] text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}><CalendarRange size={13} /><span>{timeframeLabel}</span><ChevronDown size={12} /></button>
        {timeframeOpen && <div className="menu-enter absolute right-0 top-9 z-40 w-[278px] rounded-md border border-slate-200 bg-white p-2 shadow-lg">
          <div className="mb-1.5 flex items-center justify-between px-1"><span className="font-mono text-[9px] font-medium uppercase tracking-[.09em] text-slate-500">Time range</span><span className="font-mono text-[10px] text-slate-400">{rangeLabel}</span></div>
          <div className="grid grid-cols-4 gap-1">{periods.map(item => <button key={item} onClick={() => { setPeriod(item); setTimeframeOpen(false); }} className={`rounded border px-1.5 py-1.5 font-mono text-[10px] transition-colors ${period === item ? 'border-[#5b6fc9] bg-[#5b6fc9] text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>{item === 'MAX' ? 'MAX' : `${item}Y`}</button>)}</div>
          <div className="my-1.5 border-t border-slate-100" />
          <div className="mb-0.5 flex items-center justify-between px-1"><span className="font-mono text-[9px] font-medium uppercase tracking-[.09em] text-slate-500">Custom annual range</span><span className="font-mono text-[9px] text-slate-400">{earliestYear}–{latestYear}</span></div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-1.5"><label className="grid gap-1"><span className="font-mono text-[9px] uppercase tracking-[.08em] text-slate-400">From</span><select value={rangeDraft.start || String(rangeStart)} onChange={event => selectRangePart('start', event.target.value)} className="h-7 rounded border border-slate-200 bg-white px-1.5 font-mono text-[10px] text-slate-700 outline-none focus:border-[#5b6fc9]">{allYears.map(year => <option key={year} value={year}>{year}</option>)}</select></label><span className="pb-1.5 text-[10px] text-slate-400">—</span><label className="grid gap-1"><span className="font-mono text-[9px] uppercase tracking-[.08em] text-slate-400">To</span><select value={rangeDraft.end || String(rangeEnd)} onChange={event => selectRangePart('end', event.target.value)} className="h-7 rounded border border-slate-200 bg-white px-1.5 font-mono text-[10px] text-slate-700 outline-none focus:border-[#5b6fc9]">{allYears.map(year => <option key={year} value={year}>{year}</option>)}</select></label></div>
          {!rangeIsValid && <p className="mt-1 font-mono text-[9px] text-rose-600">End year must be on or after start year.</p>}
        </div>}
      </div>
    </div></header>
    <div className="grain"><div className="mx-auto max-w-[1120px] px-3 pb-6">
      <section className="py-2"><Card className="flex flex-wrap items-center gap-1.5 px-2 py-1.5">{selectedMarkets.map((code, index) => <span key={code} className="inline-flex h-6 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-medium text-slate-700"><span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: colorFor(code, index), border: `1px solid ${colorFor(code, index)}` }} />{marketName(code)}</span>)}</Card></section>
      <section className="py-2"><MarketSnapshot markets={visible} /></section>
      {selectedModes.has('ai-capital') && <section className="py-2"><Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 px-3 py-2"><p className="font-mono text-[10px] uppercase tracking-[.1em] text-slate-500">AI capital flow</p><span className="font-mono text-[10px] text-slate-400">latest annual observation</span></div><div className="overflow-x-auto"><table className="w-full min-w-[940px] border-collapse text-left"><thead className="border-b border-slate-100 bg-slate-50/60 font-mono text-[10px] uppercase tracking-[.07em] text-slate-400"><tr><th className="px-3 py-2 font-medium">Market</th><th className="px-3 py-2 font-medium">AI investment</th><th className="px-3 py-2 font-medium">AI VC</th><th className="px-3 py-2 font-medium">AI VC / GDP</th><th className="px-3 py-2 font-medium">5Y VC CAGR</th><th className="px-3 py-2 font-medium">AI VC YoY</th><th className="px-3 py-2 font-medium">AI share of VC</th></tr></thead><tbody>{aiMetrics.map(({ market, index, current, aiToGdp, cagr }) => <tr key={market.country} className="border-b border-slate-100 last:border-0"><td className="px-3 py-2"><div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorFor(market.country, index) }} /><div><p className="text-[11px] font-semibold text-slate-800">{market.name}</p><p className="font-mono text-[10px] text-slate-400">{current?.year ?? '—'}</p></div></div></td><td className="px-3 py-2"><p className="text-sm font-semibold text-slate-800">{compactCurrency(current?.aiInvestment ?? null)}</p></td><td className="px-3 py-2"><p className="text-sm font-semibold text-slate-800">{compactCurrency(current?.aiVentureCapitalInvestment ?? null)}</p></td><td className="px-3 py-2"><p className="text-sm font-semibold text-slate-800">{percent(aiToGdp, 2)}</p></td><td className="px-3 py-2"><p className="text-sm font-semibold text-slate-800">{percent(cagr, 1)}</p></td><td className="px-3 py-2"><p className="text-sm font-semibold text-slate-800">{percent(current?.aiInvestmentGrowth ?? null, 1)}</p></td><td className="px-3 py-2"><p className="text-sm font-semibold text-slate-800">{percent(current?.aiShareOfTotalVc ?? null, 1)}</p></td></tr>)}</tbody></table></div></Card></section>}
      {selectedModes.has('bubbles') && <BubbleLibrary bubbles={BUBBLE_LIBRARY} />}
      <section className="py-2">
        {selectedModes.has('ai-capital') && !hasAiObservations ? (
          <Card className="overflow-hidden">
            <div className="flex overflow-x-auto border-b border-slate-100 bg-slate-100/70 p-1 gap-1">
              {views.map(view => {
                const isActive = selectedModes.has(view.id);
                return (
                  <button
                    key={view.id}
                    onClick={() => toggleMode(view.id)}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1 font-mono text-[10px] font-medium transition-all ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-sm ring-1 ring-slate-900/10'
                        : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-blue-400' : 'bg-slate-400/50'}`} />
                    {view.label}
                  </button>
                );
              })}
            </div>
            <div className="grid min-h-[230px] place-items-center p-5 text-center">
              <div>
                <p className="text-sm font-semibold text-slate-800">No annual AI capital-flow coverage for these markets</p>
                <p className="mx-auto mt-2 max-w-md text-[11px] leading-5 text-slate-500">The source has not published a compatible annual observation for the current selection. Select the United States, United Kingdom, or Japan to view the verified OECD baseline, or connect the public OECD feed when it becomes available.</p>
              </div>
            </div>
          </Card>
        ) : (
          <ChartPanel
            title={currentView.title}
            subtitle={currentView.subtitle}
            option={currentView.option}
            height={selectedModes.has('valuation') && selectedModes.size === 1 ? 'h-[440px]' : undefined}
            legend={activeLegend}
            toolbar={
              <div className="flex max-w-[560px] items-center gap-1 overflow-x-auto rounded-md border border-slate-200 bg-slate-100/70 p-0.5">
                {views.map(view => {
                  const isActive = selectedModes.has(view.id);
                  return (
                    <button
                      key={view.id}
                      onClick={() => toggleMode(view.id)}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1 font-mono text-[10px] font-medium transition-all ${
                        isActive
                          ? 'bg-slate-900 text-white shadow-sm ring-1 ring-slate-900/10'
                          : 'text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-blue-400' : 'bg-slate-400/50'}`} />
                      {view.label}
                    </button>
                  );
                })}
              </div>
            }
          />
        )}
      </section>
      <section className="mb-3 flex items-start gap-2 rounded-md border border-blue-100 bg-blue-50/50 px-3 py-2 text-[11px] leading-5 text-slate-600">
        <Info size={14} className="mt-0.5 shrink-0 text-blue-600" />
        {selectedModes.has('buffett') ? (
          <p><span className="font-semibold text-slate-800">Reading flow equilibrium:</span> the visible band is each market’s rolling 10-year Buffett average ± two standard deviations—a broader historical envelope—while its dashed centre line is the adaptive baseline. The 100% line is a reference centre only, not a universal fair-value target. A line outside its own band signals an unusually large market-cap/GDP gap versus that market’s history.</p>
        ) : selectedModes.has('ai-capital') ? (
          <p><span className="font-semibold text-slate-800">AI capital intensity:</span> the default view normalizes reported AI VC by GDP, so a rise means AI-directed venture funding is becoming larger relative to the economy. Compare it with Buffett separately for context—this view does not claim that AI funding causes market valuations. Points are observed annual values; the dashed line is a 5-year baseline. Source: <a className="underline" href={initialAiCapitalFlow?.source.url ?? 'https://oecd.ai/en/data'} target="_blank" rel="noreferrer">{initialAiCapitalFlow?.source.name ?? 'OECD.AI'}</a>{initialAiCapitalFlow?.source.latestObservationYear ? ` · latest observation ${initialAiCapitalFlow.source.latestObservationYear}` : ''}.</p>
        ) : selectedModes.has('bubbles') ? (
          <p><span className="font-semibold text-slate-800">Reading the bubble library:</span> each plotted benchmark is independently normalized to its own published peak = 100, so its path is comparable but its level is not a shared valuation measure. The library is static, source-backed historical reference data and does not respond to the selected markets or timeframe.</p>
        ) : (
          <p><span className="font-semibold text-slate-800">How to read this view:</span> compare the selected markets on the same timeline, use the tooltip for exact annual values, and scroll or drag directly on the chart to inspect a period.</p>
        )}
      </section>
      <DataSources aiSource={initialAiCapitalFlow?.source} />
    </div></div>
  </main>;
}
