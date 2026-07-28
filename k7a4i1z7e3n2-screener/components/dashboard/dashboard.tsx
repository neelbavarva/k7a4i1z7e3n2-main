'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, ChevronDown, RefreshCw } from 'lucide-react';
import type { AiCapitalFlowRecord, AiCapitalFlowResponse, EconomicsResponse, EconomicRecord } from '@/types/economics';
import { RESEARCH_MARKETS } from '@/lib/worldbank/client';
import { compactCurrency, percent } from '@/lib/formatting/numbers';
import { Card } from '@/components/ui/card';
import { DataSources } from './data-sources';
import { BubbleLibrary } from './bubble-library';
import { BUBBLE_CHART_YEARS, BUBBLE_LIBRARY } from '@/lib/bubbles/library';
import { DATASET_REGISTRY } from '@/lib/datasets/registry';
import { CompatibilityEngine } from '@/lib/datasets/compatibility';
import type { DatasetMetadata } from '@/lib/datasets/metadata';
import { AnalysisEngine } from '@/lib/analysis/engine';

// Sub-components
import { DashboardHeader } from './header';
import { MarketPills } from './market-pills';
import { MarketSnapshot } from './market-snapshot';
import { ChartPanel } from './chart-panel';
import { ModeToolbar } from './mode-toolbar';
import { InsightBanner } from './insight-banner';
import { ProjectArchitecture } from './project-architecture';

/* ─── Constants ──────────────────────────────────────────────────────────── */
const PERIODS = [1, 5, 10, 20, 30, 50, 'MAX'] as const;
const BUFFETT_BAND_DEVIATIONS = 2;
const countryCodes = new Set(['US', 'IN', 'CN', 'RU', 'JP', 'GB', 'WLD']);

const accents: Record<string, string> = {
  US: '#2563c8', IN: '#c65a13', CN: '#bd3f57', RU: '#7c4cb0',
  JP: '#a94689', GB: '#087f8c', WLD: '#0f766e', Z7E: '#5169b2',
  Z4E: '#197d74', SAS: '#5d8a47', LCN: '#9a5e9d', MEA: '#9a6510', SSF: '#8c5d3b',
};
const palette = ['#2563c8', '#c65a13', '#197d74', '#7c4cb0', '#bd3f57', '#087f8c', '#9a6510', '#a94689'];
const colorFor = (code: string, index = 0) => accents[code] ?? palette[index % palette.length];
const marketName = (code: string) => RESEARCH_MARKETS.find(([id]) => id === code)?.[1] ?? code;

/* ─── Theme helper ───────────────────────────────────────────────────────── */
function theme() {
  return {
    textStyle: { color: '#64748b', fontFamily: '"Roboto Mono", ui-monospace, monospace' },
    animationDuration: 650,
    animationDurationUpdate: 280,
    animationEasing: 'cubicOut',
    grid: { left: 18, right: 14, top: 14, bottom: 22, containLabel: false },
    tooltip: {
      trigger: 'axis', transitionDuration: 0, backgroundColor: '#ffffff',
      borderColor: '#d7dee9', borderWidth: 1,
      textStyle: { color: '#172033', fontSize: 10, fontFamily: '"Roboto Mono", ui-monospace, monospace' },
      extraCssText: 'box-shadow:0 12px 30px rgba(15,23,42,.12); border-radius:8px',
      padding: 10,
      axisPointer: { type: 'line', snap: true, lineStyle: { color: '#94a3b8', type: 'dashed' } },
    },
    dataZoom: [{ type: 'inside', filterMode: 'none', throttle: 50, zoomOnMouseWheel: true, moveOnMouseMove: true, moveOnMouseWheel: true }],
    xAxis: {
      type: 'category', boundaryGap: false, axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: '#475569', fontSize: 8, fontFamily: '"Roboto Mono", ui-monospace, monospace', hideOverlap: true, margin: 4 },
      splitLine: { show: true, lineStyle: { color: '#f1f5f9', type: 'dashed' } },
    },
    yAxis: {
      type: 'value', scale: true,
      splitLine: { show: true, lineStyle: { color: '#f1f5f9', type: 'dashed' } },
      axisLine: { show: false }, axisTick: { show: false },
      axisLabel: { color: '#475569', fontSize: 7, fontFamily: '"Roboto Mono", ui-monospace, monospace', width: 14, align: 'right', overflow: 'truncate', margin: 2 },
    },
  } as const;
}

/* ─── Dashboard ──────────────────────────────────────────────────────────── */
export function Dashboard({
  initialData,
  initialAiCapitalFlow = null,
}: {
  initialData: EconomicsResponse | null;
  initialAiCapitalFlow?: AiCapitalFlowResponse | null;
}) {
  /* ── State ── */
  const [selectedMarkets, setSelectedMarkets] = useState<string[]>(['US', 'WLD']);
  const [marketOpen, setMarketOpen] = useState(false);
  const [period, setPeriod] = useState<number | 'MAX' | 'CUSTOM'>(10);
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [rangeDraft, setRangeDraft] = useState({ start: '', end: '' });
  const [timeframeOpen, setTimeframeOpen] = useState(false);
  const [selectedModes, setSelectedModes] = useState<Set<string>>(new Set(['gdp']));
  const [aiMode, setAiMode] = useState<'intensity' | 'flow'>('intensity');
  const [isAiFlowOpen, setIsAiFlowOpen] = useState(false); // Collapsed by default

  const marketMenuRef = useRef<HTMLDivElement>(null);
  const timeframeRef  = useRef<HTMLDivElement>(null);

  /* ── Data ── */
  const data = initialData?.countries ?? [];
  const allYears = useMemo(
    () =>
      Array.from(
        new Set(
          data
            .filter(c => selectedMarkets.includes(c.country))
            .flatMap(c => c.records.map(r => r.year)),
        ),
      ).sort((a, b) => a - b),
    [data, selectedMarkets],
  );

  const earliestYear = allYears.at(0)  ?? new Date().getFullYear();
  const latestYear   = allYears.at(-1) ?? earliestYear;

  const parseYear = (value: string, fallback: number) => {
    const year = Number(value);
    return Number.isInteger(year) && allYears.includes(year) ? year : fallback;
  };

  const selectedStart =
    period === 'CUSTOM' ? parseYear(customRange.start, earliestYear)
    : period === 'MAX'  ? earliestYear
    : Math.max(earliestYear, latestYear - period + 1);

  const selectedEnd = period === 'CUSTOM' ? parseYear(customRange.end, latestYear) : latestYear;
  const rangeStart  = Math.min(selectedStart, selectedEnd);
  const rangeEnd    = Math.max(selectedStart, selectedEnd);
  const rangeLabel  = `${rangeStart}–${rangeEnd}`;

  const draftStart   = parseYear(rangeDraft.start, rangeStart);
  const draftEnd     = parseYear(rangeDraft.end, rangeEnd);
  const rangeIsValid = Boolean(rangeDraft.start && rangeDraft.end) && draftStart <= draftEnd;

  /* ── Handlers ── */
  const toggleTimeframe = () => {
    if (!timeframeOpen) setRangeDraft({ start: String(rangeStart), end: String(rangeEnd) });
    setTimeframeOpen(open => !open);
  };

  const selectRangePart = (part: 'start' | 'end', value: string) => {
    const next = { ...rangeDraft, [part]: value };
    setRangeDraft(next);
    if (next.start && next.end && Number(next.start) <= Number(next.end)) {
      setCustomRange(next);
      setPeriod('CUSTOM');
    }
  };

  const toggleMarket = (market: string) =>
    setSelectedMarkets(current =>
      current.includes(market)
        ? current.length === 1 ? current : current.filter(c => c !== market)
        : [...current, market],
    );

  const toggleMode = (modeId: string) => {
    setSelectedModes(prev => {
      const next = new Set(prev);
      if (next.has(modeId)) {
        if (next.size > 1) next.delete(modeId);
      } else {
        next.add(modeId);
      }
      return next;
    });
  };

  // Close menus on outside click
  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as Node;
      if (marketMenuRef.current && !marketMenuRef.current.contains(target)) setMarketOpen(false);
      if (timeframeRef.current  && !timeframeRef.current.contains(target))  setTimeframeOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  /* ── Derived data ── */
  const visible = useMemo(
    () =>
      data
        .filter(c => selectedMarkets.includes(c.country))
        .map(c => ({
          ...c,
          records: c.records.filter(r => r.year >= rangeStart && r.year <= rangeEnd),
        })),
    [data, selectedMarkets, rangeStart, rangeEnd],
  );

  const aiVisible = useMemo(
    () =>
      selectedMarkets.map(country => {
        const dataset = initialAiCapitalFlow?.countries.find(d => d.country === country);
        return {
          country,
          name: dataset?.name ?? marketName(country),
          records: (dataset?.records ?? []).filter(r => r.year >= rangeStart && r.year <= rangeEnd),
        };
      }),
    [initialAiCapitalFlow, selectedMarkets, rangeStart, rangeEnd],
  );

  const years = useMemo(
    () => allYears.filter(y => y >= rangeStart && y <= rangeEnd),
    [allYears, rangeStart, rangeEnd],
  );

  const aiYears = useMemo(() => {
    const observed = aiVisible.flatMap(m =>
      m.records
        .filter(r => r.aiInvestment !== null || r.aiVentureCapitalInvestment !== null)
        .map(r => r.year),
    );
    if (!observed.length) return years;
    const first = Math.min(...observed);
    const last  = Math.max(...observed);
    return years.filter(y => y >= first && y <= last);
  }, [aiVisible, years]);

  /* ── Accessors ── */
  const valuesFor = (market: typeof visible[number], metric: keyof EconomicRecord) => {
    const byYear = new Map(market.records.map(r => [r.year, r]));
    return years.map(y => { const v = byYear.get(y)?.[metric]; return typeof v === 'number' ? v : null; });
  };

  const aiValuesFor = (market: typeof aiVisible[number], metric: keyof AiCapitalFlowRecord) => {
    const byYear = new Map(market.records.map(r => [r.year, r]));
    return aiYears.map(y => { const v = byYear.get(y)?.[metric]; return typeof v === 'number' ? v : null; });
  };

  const aiIntensityFor = (market: typeof aiVisible[number]) =>
    aiYears.map(y => {
      const flow = market.records.find(r => r.year === y)?.aiInvestment
                ?? market.records.find(r => r.year === y)?.aiVentureCapitalInvestment
                ?? null;
      const gdp  = visible.find(m => m.country === market.country)?.records.find(r => r.year === y)?.gdp ?? null;
      return flow !== null && gdp !== null && gdp > 0 ? (flow / gdp) * 100 : null;
    });

  /* ── Chart helpers ── */
  const rollingBand = (values: (number | null)[]) =>
    values.map((_, i) => {
      const set = values.slice(Math.max(0, i - 9), i + 1).filter((v): v is number => v !== null);
      if (!set.length) return { mean: null, lower: null, range: null };
      const mean     = set.reduce((s, v) => s + v, 0) / set.length;
      const variance = set.reduce((s, v) => s + (v - mean) ** 2, 0) / set.length;
      const deviation = Math.sqrt(variance) * BUFFETT_BAND_DEVIATIONS;
      return { mean, lower: Math.max(0, mean - deviation), range: deviation * 2 };
    });

  const timeAxis   = () => ({ ...theme().xAxis, data: years.map(String),   axisLabel: { ...theme().xAxis.axisLabel, formatter: (v: string, i: number) => i === 0 ? '' : v } });
  const aiTimeAxis = () => ({ ...theme().xAxis, data: aiYears.map(String), axisLabel: { ...theme().xAxis.axisLabel, formatter: (v: string, i: number) => i === 0 ? '' : v } });
  const indexed    = (values: (number | null)[]) => {
    const base = values.find((v): v is number => v !== null && v > 0);
    return values.map(v => base && v !== null ? (v / base) * 100 : null);
  };

  const isMulti = selectedModes.size > 1;

  /* ── Single-mode options ── */
  const lineOption = (metric: keyof EconomicRecord, unit: '$' | '%', guides = false) => ({
    ...theme(),
    tooltip: {
      ...theme().tooltip,
      formatter: (items: { axisValueLabel?: string; marker?: string; seriesName?: string; value?: unknown }[]) => {
        const rows  = (Array.isArray(items) ? items : []).filter(item => item.seriesName);
        const label = rows[0]?.axisValueLabel ?? '';
        return [
          `<strong>${label}</strong>`,
          ...rows.map(item => {
            const value   = typeof item.value === 'number' ? item.value : Number(item.value);
            const display = unit === '$' ? `$${(value / 1e12).toFixed(2)}T` : `${value.toFixed(1)}%`;
            return `${item.marker ?? ''}${item.seriesName} <strong>${display}</strong>`;
          }),
        ].join('<br/>');
      },
    },
    xAxis: timeAxis(),
    yAxis: {
      ...theme().yAxis,
      axisLabel: { ...theme().yAxis.axisLabel, formatter: (v: number) => metric === 'gdp' && v === 0 ? '' : unit === '$' ? `${Math.round(v / 1e12)}` : `${v}%` },
    },
    legend: { show: false },
    series: visible.flatMap((market, index) => {
      const values = valuesFor(market, metric);
      const band   = rollingBand(values);
      const color  = colorFor(market.country, index);
      const raw = {
        bandOwner: `buffett-${market.country}`, name: market.name, type: 'line', smooth: 0.32,
        smoothMonotone: 'x', connectNulls: false, showSymbol: false,
        lineStyle: { width: 2.6, color }, itemStyle: { color }, areaStyle: { opacity: .045 },
        emphasis: { focus: 'series', lineStyle: { width: 3.3 } }, data: values,
        markLine: guides ? { silent: true, symbol: 'none', lineStyle: { color: '#94a3b8', type: 'dashed', width: 1 }, label: { show: false }, data: [{ yAxis: 100 }] } : undefined,
      };
      if (!guides) return [raw];
      return [
        raw,
        { bandOwner: `buffett-${market.country}`, name: '', type: 'line', stack: `band-${market.country}`, showSymbol: false, data: band.map(p => p.lower), lineStyle: { opacity: 0 }, areaStyle: { opacity: 0 }, silent: true, tooltip: { show: false } },
        { bandOwner: `buffett-${market.country}`, name: '', type: 'line', stack: `band-${market.country}`, showSymbol: false, data: band.map(p => p.range), lineStyle: { opacity: 0 }, areaStyle: { color, opacity: .18 }, silent: true, tooltip: { show: false } },
        { bandOwner: `buffett-${market.country}`, name: '', type: 'line', smooth: 0.4, smoothMonotone: 'x', showSymbol: false, data: band.map(p => p.mean), lineStyle: { color, width: 1.5, type: 'dashed', opacity: .85 }, silent: true, tooltip: { show: false } },
      ];
    }),
  });

  const growthOption = {
    ...theme(), xAxis: timeAxis(),
    yAxis: { ...theme().yAxis, axisLabel: { ...theme().yAxis.axisLabel, formatter: '{value}%' } },
    legend: { show: false },
    series: visible.map((market, index) => ({
      name: market.name, type: 'bar', barMaxWidth: 16,
      itemStyle: { color: colorFor(market.country, index), borderRadius: [3, 3, 0, 0] },
      data: valuesFor(market, 'gdpGrowth'),
      markLine: index === 0 ? { silent: true, symbol: 'none', lineStyle: { color: '#64748b', width: 1.25, type: 'solid', opacity: .82 }, label: { show: false }, data: [{ yAxis: 0 }] } : undefined,
    })),
  };

  const relativeOption = {
    ...theme(), xAxis: timeAxis(),
    yAxis: { ...theme().yAxis, axisLabel: { ...theme().yAxis.axisLabel, formatter: '{value}' } },
    legend: { show: false },
    series: visible.flatMap((market, index) => {
      const color = colorFor(market.country, index);
      return [
        { name: `${market.name} GDP`, type: 'line', smooth: 0.32, showSymbol: false, data: indexed(valuesFor(market, 'gdp')), lineStyle: { color, width: 2.6 }, areaStyle: { opacity: .035 } },
        { name: `${market.name} market cap`, type: 'line', smooth: 0.32, showSymbol: false, data: indexed(valuesFor(market, 'marketCap')), lineStyle: { color, width: 2, type: 'dashed' } },
      ];
    }),
  };

  const scatterOption = {
    ...theme(),
    xAxis: { type: 'value', name: 'GDP growth', nameTextStyle: { color: '#64748b', fontSize: 9, fontFamily: '"Roboto Mono", ui-monospace, monospace' }, axisLabel: { formatter: '{value}%', color: '#64748b', fontSize: 9, fontFamily: '"Roboto Mono", ui-monospace, monospace' }, splitLine: { lineStyle: { color: '#e7edf4' } } },
    yAxis: { type: 'value', name: 'Buffett Indicator', nameTextStyle: { color: '#64748b', fontSize: 9, fontFamily: '"Roboto Mono", ui-monospace, monospace' }, axisLabel: { formatter: '{value}%', color: '#64748b', fontSize: 9, fontFamily: '"Roboto Mono", ui-monospace, monospace' }, splitLine: { lineStyle: { color: '#e7edf4' } } },
    series: visible.map((market, index) => ({
      name: market.name, type: 'scatter', symbolSize: 9,
      itemStyle: { color: colorFor(market.country, index), opacity: .82 },
      data: market.records.filter(r => r.gdpGrowth !== null && r.buffettIndicator !== null).map(r => [r.gdpGrowth, r.buffettIndicator]),
    })),
  };

  const rollingFiveYear = (values: (number | null)[]) =>
    values.map((_, i) => {
      const w = values.slice(Math.max(0, i - 4), i + 1).filter((v): v is number => v !== null);
      return w.length === 5 ? w.reduce((s, v) => s + v, 0) / w.length : null;
    });

  const aiRawCapitalOption = {
    ...theme(),
    tooltip: {
      ...theme().tooltip,
      formatter: (items: { axisValueLabel?: string; marker?: string; seriesName?: string; value?: unknown }[]) => {
        const rows  = (Array.isArray(items) ? items : []).filter(item => item.seriesName && typeof item.value === 'number');
        const label = rows[0]?.axisValueLabel ?? '';
        return [`<strong>${label}</strong>`, ...rows.map(item => `${item.marker ?? ''}${item.seriesName} <strong>${compactCurrency(item.value as number)}</strong>`)].join('<br/>');
      },
    },
    xAxis: aiTimeAxis(),
    yAxis: { ...theme().yAxis, axisLabel: { ...theme().yAxis.axisLabel, formatter: (v: number) => v === 0 ? '' : `$${v >= 1e9 ? `${(v / 1e9).toFixed(0)}B` : `${(v / 1e6).toFixed(0)}M`}` } },
    legend: { show: false },
    series: aiVisible.map((market, index) => ({
      name: `${market.name} · AI VC`, type: 'line', smooth: false, connectNulls: false, showSymbol: true, symbolSize: 5,
      data: aiValuesFor(market, 'aiVentureCapitalInvestment'),
      lineStyle: { width: 2.2, color: colorFor(market.country, index), type: 'dashed' },
      itemStyle: { color: colorFor(market.country, index) },
      emphasis: { focus: 'series', lineStyle: { width: 3 } },
    })),
  };

  const aiIntensityOption = {
    ...theme(),
    tooltip: {
      ...theme().tooltip,
      formatter: (items: { axisValueLabel?: string; marker?: string; seriesName?: string; value?: unknown }[]) => {
        const rows  = (Array.isArray(items) ? items : []).filter(item => item.seriesName && typeof item.value === 'number' && !item.seriesName.includes('5Y baseline'));
        const label = rows[0]?.axisValueLabel ?? '';
        return [`<strong>${label}</strong>`, ...rows.map(item => `${item.marker ?? ''}${item.seriesName} <strong>${((item.value as number) * 100).toFixed(1)} bps of GDP</strong>`)].join('<br/>');
      },
    },
    xAxis: aiTimeAxis(),
    yAxis: { ...theme().yAxis, axisLabel: { ...theme().yAxis.axisLabel, formatter: (v: number) => `${v.toFixed(2)}%` } },
    legend: { show: false },
    series: aiVisible.flatMap((market, index) => {
      const values = aiIntensityFor(market);
      const color  = colorFor(market.country, index);
      return [
        { name: `${market.name} · AI VC / GDP`, type: 'line', smooth: false, connectNulls: false, showSymbol: true, symbolSize: 5, data: values, lineStyle: { width: 2.4, color }, itemStyle: { color }, areaStyle: { color, opacity: .035 }, emphasis: { focus: 'series', lineStyle: { width: 3.1 } } },
        { name: `${market.name} · 5Y baseline`, type: 'line', smooth: false, connectNulls: false, showSymbol: false, data: rollingFiveYear(values), lineStyle: { width: 1.4, color, type: 'dashed', opacity: .7 }, silent: true, tooltip: { show: false } },
      ];
    }),
  };

  const aiCapitalOption = aiMode === 'intensity' ? aiIntensityOption : aiRawCapitalOption;

  const bubbleChartOption = {
    ...theme(),
    xAxis: { ...theme().xAxis, data: BUBBLE_CHART_YEARS.map(String), axisLabel: { ...theme().xAxis.axisLabel, formatter: (v: string, i: number) => i === 0 ? '' : v } },
    yAxis: { ...theme().yAxis, axisLabel: { ...theme().yAxis.axisLabel, formatter: (v: number) => `${Math.round(v)}` } },
    legend: { show: false },
    series: BUBBLE_LIBRARY.filter(b => b.chart && b.chart.points.length > 1).map((bubble, index) => {
      const pointByYear = new Map(bubble.chart?.points.map(p => [p.year, p.value]));
      const color = palette[index % palette.length];
      return {
        name: `${bubble.name} · peak = 100`, type: 'line', smooth: false, connectNulls: false, showSymbol: true, symbolSize: 4,
        data: BUBBLE_CHART_YEARS.map(year => pointByYear.get(year) ?? null),
        lineStyle: { width: 2.3, color }, itemStyle: { color }, areaStyle: { color, opacity: .035 },
        emphasis: { focus: 'series', lineStyle: { width: 3 } },
      };
    }),
  };

  /* ── Active dataset metadata ── */
  const activeDatasetMetadatas = useMemo(() => {
    const list: DatasetMetadata[] = [];
    selectedModes.forEach(id => {
      if (id === 'gdp')        list.push(DATASET_REGISTRY.gdp);
      else if (id === 'market-cap') list.push(DATASET_REGISTRY.marketCap);
      else if (id === 'buffett')    list.push(DATASET_REGISTRY.buffett);
      else if (id === 'growth')     list.push(DATASET_REGISTRY.gdpGrowth);
      else if (id === 'ai-capital') list.push(DATASET_REGISTRY.aiInvestment);
      else if (id === 'valuation')  list.push(DATASET_REGISTRY.valuation);
      else if (id === 'bubbles')    list.push(DATASET_REGISTRY.bubbles);
      else if (id === 'relative')   list.push(DATASET_REGISTRY.gdp, DATASET_REGISTRY.marketCap);
    });
    return list;
  }, [selectedModes]);

  /* ── Multi-mode option ── */
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
          market, nonBubbleDatasets, years, color, visible, aiVisible, aiYears,
        );
        seriesList.push(...(marketSeries as unknown as Record<string, unknown>[]));
      });
    }

    if (selectedModes.has('bubbles')) {
      BUBBLE_LIBRARY.filter(b => b.chart && b.chart.points.length > 1).forEach((bubble, index) => {
        const pointByYear = new Map(bubble.chart?.points.map(p => [p.year, p.value]));
        const color = palette[index % palette.length];
        seriesList.push({
          name: `${bubble.name} · peak = 100`, type: 'line', smooth: false, connectNulls: false, showSymbol: true, symbolSize: 4,
          data: BUBBLE_CHART_YEARS.map(year => pointByYear.get(year) ?? null),
          lineStyle: { width: 2.3, color }, itemStyle: { color },
        });
      });
    }

    return { ...theme(), xAxis: timeAxis(), yAxis: { ...theme().yAxis, axisLabel: { ...theme().yAxis.axisLabel, formatter: '{value}' } }, series: seriesList };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModes, isMulti, visible, aiVisible, activeDatasetMetadatas, years, aiYears]);

  /* ── Views definition ── */
  const views = [
    { id: 'gdp',        label: 'GDP',        title: 'GDP over time',                              subtitle: 'Nominal GDP · current US dollars',                                                                          option: lineOption('gdp', '$') },
    { id: 'market-cap', label: 'Market cap', title: 'Stock market capitalization',                subtitle: 'Listed domestic companies · current US dollars',                                                            option: lineOption('marketCap', '$') },
    { id: 'buffett',    label: 'Buffett',     title: 'Market capitalization relative to GDP',      subtitle: 'Market cap ÷ GDP · reference lines are context only',                                                       option: lineOption('buffettIndicator', '%', true) },
    { id: 'relative',   label: 'Relative',   title: 'GDP versus market cap',                      subtitle: 'Indexed to first complete year = 100 · solid GDP / dashed market cap',                                     option: relativeOption },
    { id: 'growth',     label: 'Growth',     title: 'GDP growth',                                 subtitle: 'Annual real GDP growth',                                                                                    option: growthOption },
    { id: 'ai-capital', label: 'AI flow',    title: aiMode === 'intensity' ? 'AI capital intensity' : 'AI venture-capital flow', subtitle: aiMode === 'intensity' ? 'AI VC as a share of GDP · observed annual points with 5Y baseline' : 'Observed annual AI VC investment · no interpolated values', option: aiCapitalOption },
    { id: 'bubbles',    label: 'Bubbles',    title: 'Historical bubble library',                  subtitle: 'Source-backed benchmark reference paths · independent of market and timeframe filters',                     option: bubbleChartOption },
    { id: 'valuation',  label: 'Valuation',  title: 'Valuation versus economic growth',           subtitle: 'Each point represents one year',                                                                           option: scatterOption },
  ];

  const singleActiveId = selectedModes.size === 1 ? Array.from(selectedModes)[0] : null;
  const currentView = singleActiveId
    ? (views.find(v => v.id === singleActiveId) ?? views[0])
    : {
        id: 'multi',
        title: 'Macro Research Terminal',
        subtitle: `Multi-dataset view (${Array.from(selectedModes).map(id => views.find(v => v.id === id)?.label ?? id).join(', ')})`,
        option: multiOption ?? views[0].option,
      };

  const axisHint = CompatibilityEngine.generateAxisHint(activeDatasetMetadatas);

  /* ── Legend badges ── */
  const marketBadges = visible.map((market, index) => {
    const color    = colorFor(market.country, index);
    const statuses = activeDatasetMetadatas
      .map(dataset => {
        let vals: (number | null)[] = [];
        if (dataset.id === 'gdp')        vals = valuesFor(market, 'gdp');
        else if (dataset.id === 'marketCap')  vals = valuesFor(market, 'marketCap');
        else if (dataset.id === 'buffett')    vals = valuesFor(market, 'buffettIndicator');
        else if (dataset.id === 'gdpGrowth')  vals = valuesFor(market, 'gdpGrowth');
        else if (dataset.id === 'aiInvestment') {
          const aiMarket = aiVisible.find(m => m.country === market.country);
          vals = aiMarket ? aiValuesFor(aiMarket, 'aiVentureCapitalInvestment') : [];
        }
        if (!vals.length) return null;
        const result = AnalysisEngine.analyze(dataset, vals, market.country);
        return `${dataset.shortName}: ${result.statusLabel}`;
      })
      .filter((s): s is string => Boolean(s));

    const statusText = statuses.length ? ` (${statuses.join(' · ')})` : '';

    return (
      <span key={market.country} className="badge">
        <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: color, border: `1px solid ${color}` }} aria-hidden="true" />
        <span className="font-medium">{market.name}</span>
        {statusText && <span className="font-mono text-[9.5px] text-slate-500">{statusText}</span>}
      </span>
    );
  });

  const axisHintBadge = (
    <span className="badge font-mono whitespace-nowrap">{axisHint}</span>
  );

  const marketLegend = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-1.5">{marketBadges}</div>
      <div className="flex shrink-0 items-center">{axisHintBadge}</div>
    </div>
  );

  const relativeLegend = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="badge">solid GDP · patterned market cap</span>
        {visible.map((market, index) => {
          const color = colorFor(market.country, index);
          return (
            <span key={market.country} className="badge">
              <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: color, border: `1px solid ${color}` }} aria-hidden="true" />
              <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: `${color}24`, border: `1px solid ${color}`, backgroundImage: `repeating-linear-gradient(-45deg, transparent 0 2px, ${color} 2px 3px)` }} aria-hidden="true" />
              <span className="font-medium">{market.name}</span>
            </span>
          );
        })}
      </div>
      <div className="flex shrink-0 items-center">{axisHintBadge}</div>
    </div>
  );

  const aiLegend = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="badge">{aiMode === 'intensity' ? 'observed AI VC / GDP · dashed 5Y baseline' : 'observed annual AI VC · no interpolation'}</span>
        {aiVisible.map((market, index) => {
          const color = colorFor(market.country, index);
          return (
            <span key={market.country} className="badge">
              <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: color, border: `1px solid ${color}` }} aria-hidden="true" />
              <span className="font-medium">{market.name}</span>
            </span>
          );
        })}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <div className="flex h-6 items-center rounded-md border border-slate-200 bg-slate-50 p-0.5" role="group" aria-label="AI metric toggle">
          <button
            onClick={() => setAiMode('intensity')}
            aria-pressed={aiMode === 'intensity'}
            className={`h-5 rounded px-2 font-mono text-[9px] font-medium transition-colors ${aiMode === 'intensity' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
          >
            AI / GDP
          </button>
          <button
            onClick={() => setAiMode('flow')}
            aria-pressed={aiMode === 'flow'}
            className={`h-5 rounded px-2 font-mono text-[9px] font-medium transition-colors ${aiMode === 'flow' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Raw VC
          </button>
        </div>
        {axisHintBadge}
      </div>
    </div>
  );

  const bubbleLegend = (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="badge">source observations · peak = 100</span>
        {BUBBLE_LIBRARY.filter(b => b.chart).map((bubble, index) => (
          <span key={bubble.id} className="badge">
            <span className="h-2 w-2 shrink-0 rounded-[2px]" style={{ backgroundColor: palette[index % palette.length], border: `1px solid ${palette[index % palette.length]}` }} aria-hidden="true" />
            <span className="font-medium">{bubble.name}</span>
          </span>
        ))}
      </div>
      <div className="flex shrink-0 items-center">{axisHintBadge}</div>
    </div>
  );

  /* ── AI metrics table data ── */
  const aiMetrics = aiVisible.map((market, index) => {
    const current = [...market.records].reverse().find(r => r.aiInvestment !== null || r.aiVentureCapitalInvestment !== null);
    const gdp = current ? visible.find(m => m.country === market.country)?.records.find(r => r.year === current.year)?.gdp ?? null : null;
    const currentFlow = current?.aiInvestment ?? current?.aiVentureCapitalInvestment ?? null;
    const baseRecord  = current ? market.records.find(r => r.year === current.year - 5) : undefined;
    const base = baseRecord?.aiInvestment ?? baseRecord?.aiVentureCapitalInvestment ?? null;
    const cagr = currentFlow !== null && base !== null && base > 0 ? ((currentFlow / base) ** (1 / 5) - 1) * 100 : null;
    return { market, index, current, aiToGdp: currentFlow !== null && gdp ? (currentFlow / gdp) * 100 : null, cagr };
  });

  const hasAiObservations = aiVisible.some(m => m.records.some(r => r.aiInvestment !== null || r.aiVentureCapitalInvestment !== null));

  const activeLegend = isMulti
    ? marketLegend
    : singleActiveId === 'relative'   ? relativeLegend
    : singleActiveId === 'ai-capital' ? aiLegend
    : singleActiveId === 'bubbles'    ? bubbleLegend
    : marketLegend;

  const toolbar = (
    <ModeToolbar views={views} selectedModes={selectedModes} onToggleMode={toggleMode} />
  );

  /* ── Error state ── */
  if (!initialData) {
    return (
      <main id="main-content" className="grid min-h-screen place-items-center bg-slate-50 text-center" aria-label="Error loading data">
        <div className="max-w-sm px-4">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <AlertCircle className="text-red-500" size={24} />
          </div>
          <h1 className="text-base font-semibold text-slate-800">Unable to load economic data</h1>
          <p className="mt-2 text-sm text-slate-500">The data provider could not be reached. Please try again.</p>
          <button
            onClick={() => location.reload()}
            className="mt-5 inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors active:scale-[.97]"
          >
            <RefreshCw size={14} />
            Retry
          </button>
        </div>
      </main>
    );
  }

  const timeframeLabel = period === 'CUSTOM' ? rangeLabel : period === 'MAX' ? 'MAX' : `${period}Y`;

  /* ── Render ── */
  return (
    <main id="main-content" className="light-ui min-h-screen bg-[#fafbfc]">
      {/* Header */}
      <DashboardHeader
        selectedMarkets={selectedMarkets}
        onToggleMarket={toggleMarket}
        period={period}
        onSelectPeriod={p => { setPeriod(p); setTimeframeOpen(false); }}
        timeframeLabel={timeframeLabel}
        periods={PERIODS}
        rangeStart={rangeStart}
        rangeEnd={rangeEnd}
        earliestYear={earliestYear}
        latestYear={latestYear}
        allYears={allYears}
        rangeDraft={rangeDraft}
        onSelectRangePart={selectRangePart}
        rangeIsValid={rangeIsValid}
        rangeLabel={rangeLabel}
        marketOpen={marketOpen}
        onMarketOpenChange={setMarketOpen}
        timeframeOpen={timeframeOpen}
        onTimeframeOpenChange={open => { if (!open) { setTimeframeOpen(false); } else { toggleTimeframe(); } }}
        marketMenuRef={marketMenuRef}
        timeframeRef={timeframeRef}
      />

      <div className="grain">
        <div className="mx-auto max-w-[1120px] px-3 pb-8">

          {/* Active market pills */}
          <MarketPills selectedMarkets={selectedMarkets} onToggleMarket={toggleMarket} />

          {/* Market snapshot */}
          <section className="py-1.5 sm:py-2">
            <MarketSnapshot markets={visible} rangeStart={rangeStart} rangeEnd={rangeEnd} />
          </section>

          {/* Collapsible AI capital metrics table (Only rendered when AI Flow overlay is selected) */}
          {selectedModes.has('ai-capital') && (
            <section className="py-1.5 sm:py-2" aria-label="AI capital flow metrics">
              <Card className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => setIsAiFlowOpen(!isAiFlowOpen)}
                  aria-expanded={isAiFlowOpen}
                  aria-label="Toggle AI capital flow panel"
                  className="flex w-full items-center justify-between border-b border-slate-100 px-3.5 py-2 text-left transition-colors hover:bg-slate-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  <div className="flex items-center gap-2">
                    <span className="section-label">AI capital flow</span>
                    <span className="font-mono text-[10px] text-slate-400">latest annual observation</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] text-slate-400">
                      {isAiFlowOpen ? 'Click to collapse' : 'Click to expand'}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`text-slate-400 transition-transform duration-200 ${
                        isAiFlowOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </div>
                </button>

                {isAiFlowOpen && (
                  <div className="slide-down overflow-x-auto no-scrollbar">
                    <table className="w-full min-w-[940px] border-collapse text-left">
                      <thead className="border-b border-slate-100 bg-slate-50/70">
                        <tr className="section-label text-[9px]">
                          <th className="px-3 py-1.5 font-medium">Market</th>
                          <th className="px-3 py-1.5 font-medium">AI investment</th>
                          <th className="px-3 py-1.5 font-medium">AI VC</th>
                          <th className="px-3 py-1.5 font-medium">AI VC / GDP</th>
                          <th className="px-3 py-1.5 font-medium">5Y VC CAGR</th>
                          <th className="px-3 py-1.5 font-medium">AI VC YoY</th>
                          <th className="px-3 py-1.5 font-medium">AI share of VC</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aiMetrics.map(({ market, index, current, aiToGdp, cagr }) => (
                          <tr key={market.country} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60 transition-colors">
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: colorFor(market.country, index) }} aria-hidden="true" />
                                <div>
                                  <p className="text-[11px] font-semibold text-slate-800">{market.name}</p>
                                  <p className="font-mono text-[9.5px] text-slate-400">{current?.year ?? '—'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-3 py-2"><p className="metric-value text-[11.5px] font-semibold text-slate-800">{compactCurrency(current?.aiInvestment ?? null)}</p></td>
                            <td className="px-3 py-2"><p className="metric-value text-[11.5px] font-semibold text-slate-800">{compactCurrency(current?.aiVentureCapitalInvestment ?? null)}</p></td>
                            <td className="px-3 py-2"><p className="metric-value text-[11.5px] font-semibold text-slate-800">{percent(aiToGdp, 2)}</p></td>
                            <td className="px-3 py-2"><p className="metric-value text-[11.5px] font-semibold text-slate-800">{percent(cagr, 1)}</p></td>
                            <td className="px-3 py-2"><p className="metric-value text-[11.5px] font-semibold text-slate-800">{percent(current?.aiInvestmentGrowth ?? null, 1)}</p></td>
                            <td className="px-3 py-2"><p className="metric-value text-[11.5px] font-semibold text-slate-800">{percent(current?.aiShareOfTotalVc ?? null, 1)}</p></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </section>
          )}

          {/* Collapsible Bubble library reference table (Only rendered when Bubble overlay is selected) */}
          {selectedModes.has('bubbles') && <BubbleLibrary bubbles={BUBBLE_LIBRARY} />}

          {/* Main chart panel */}
          <section className="py-1.5 sm:py-2">
            {selectedModes.has('ai-capital') && !hasAiObservations ? (
              <Card className="overflow-hidden">
                <div className="flex overflow-x-auto no-scrollbar border-b border-slate-100 bg-slate-100/70 p-1 gap-1">
                  {toolbar}
                </div>
                <div className="grid min-h-[230px] place-items-center p-5 text-center">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">No annual AI capital-flow coverage for these markets</p>
                    <p className="mx-auto mt-2 max-w-md text-[11px] leading-5 text-slate-500">
                      The source has not published a compatible annual observation for the current selection.
                      Select the United States, United Kingdom, or Japan to view the verified OECD baseline,
                      or connect the public OECD feed when it becomes available.
                    </p>
                  </div>
                </div>
              </Card>
            ) : (
              <ChartPanel
                title={currentView.title}
                subtitle={currentView.subtitle}
                option={currentView.option}
                height={selectedModes.has('valuation') && selectedModes.size === 1 ? 'h-[360px] sm:h-[440px]' : undefined}
                legend={activeLegend}
                toolbar={toolbar}
              />
            )}
          </section>

          {/* Insight banner */}
          <InsightBanner
            selectedModes={selectedModes}
            aiSourceName={initialAiCapitalFlow?.source.name}
            aiSourceUrl={initialAiCapitalFlow?.source.url}
            aiLatestYear={initialAiCapitalFlow?.source.latestObservationYear}
          />

          {/* Data sources */}
          <DataSources aiSource={initialAiCapitalFlow?.source} />

          {/* Project Architecture & Roadmap */}
          <ProjectArchitecture />
        </div>
      </div>
    </main>
  );
}
