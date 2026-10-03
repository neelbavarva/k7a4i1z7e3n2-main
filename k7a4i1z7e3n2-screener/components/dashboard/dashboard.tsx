'use client';

import { useEffect, useMemo, useState } from 'react';
import type { AiCapitalFlowRecord, AiCapitalFlowResponse, EconomicsResponse, EconomicRecord } from '@/types/economics';
import { compactCurrency, percent } from '@/lib/formatting/numbers';
import { DataSources } from './data-sources';
import { BubbleLibrary } from './bubble-library';
import { BUBBLE_CHART_YEARS, BUBBLE_LIBRARY } from '@/lib/bubbles/library';
import { DATASET_REGISTRY } from '@/lib/datasets/registry';
import { CompatibilityEngine } from '@/lib/datasets/compatibility';
import type { DatasetMetadata } from '@/lib/datasets/metadata';
import { AnalysisEngine } from '@/lib/analysis/engine';
import { PALETTE as palette, colorFor, marketName } from '@/lib/markets';
import { MarketIcon } from '@/components/ui/market-icon';

// Sub-components
import { StatusBar, TopBar, Timeframe, useRelative } from './header';
import { MarketPicker } from './market-picker';
import { Brief, MarketRows } from './market-snapshot';
import { ChartPanel } from './chart-panel';
import { ModeToolbar } from './mode-toolbar';
import { InsightBanner } from './insight-banner';
import { ProjectArchitecture } from './project-architecture';

/* ─── Constants ──────────────────────────────────────────────────────────── */
// Annual data: a 1-year window is a single point, so presets start at 5 years.
const PERIODS = [5, 10, 20, 30, 50, 'MAX'] as const;
const BUFFETT_BAND_DEVIATIONS = 2;

/* ─── Option base ───────────────────────────────────────────────────────── */
// Charts keep the option shape they were written in; the Lightweight Charts adapter
// reads series, xAxis.data and valueFormat. All styling lives in globals.css and the
// adapter, so there are no colours or font sizes here.
function theme() {
  return { tooltip: {}, xAxis: { axisLabel: {} }, yAxis: { axisLabel: {} } } as const;
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [focusMarket, setFocusMarket] = useState('US');
  const [period, setPeriod] = useState<number | 'MAX' | 'CUSTOM'>(10);
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [rangeDraft, setRangeDraft] = useState({ start: '', end: '' });
  const [selectedModes, setSelectedModes] = useState<Set<string>>(new Set(['gdp']));
  const [aiMode, setAiMode] = useState<'intensity' | 'flow'>('intensity');


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
  const openCustomRange = () => setRangeDraft({ start: String(rangeStart), end: String(rangeEnd) });

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

  // Cmd/Ctrl+K opens the market picker from anywhere (as on FX Fundamental Bias)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPickerOpen(v => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // keep the focused market (the one the brief describes) inside the selection
  const focus = selectedMarkets.includes(focusMarket) ? focusMarket : selectedMarkets[0];

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
    valueFormat: unit === '$' ? 'usd' : 'pct',
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
        markLine: guides ? { silent: true, symbol: 'none', lineStyle: { color: '#a3aa9f', type: 'dashed', width: 1 }, label: { show: false }, data: [{ yAxis: 100 }] } : undefined,
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
    ...theme(), valueFormat: 'pct', xAxis: timeAxis(),
    yAxis: { ...theme().yAxis, axisLabel: { ...theme().yAxis.axisLabel, formatter: '{value}%' } },
    legend: { show: false },
    series: visible.map((market, index) => ({
      name: market.name, type: 'bar', barMaxWidth: 16,
      itemStyle: { color: colorFor(market.country, index), borderRadius: [3, 3, 0, 0] },
      data: valuesFor(market, 'gdpGrowth'),
      markLine: index === 0 ? { silent: true, symbol: 'none', lineStyle: { color: '#7c837a', width: 1.25, type: 'solid', opacity: .82 }, label: { show: false }, data: [{ yAxis: 0 }] } : undefined,
    })),
  };

  const relativeOption = {
    ...theme(), valueFormat: 'index', xAxis: timeAxis(),
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
    xAxis: { type: 'value', name: 'GDP growth' },
    yAxis: { type: 'value', name: 'Buffett indicator' },
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
    valueFormat: 'usd',
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
    valueFormat: 'pct2',
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
    ...theme(), valueFormat: 'index',
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

    return { ...theme(), valueFormat: 'auto', xAxis: timeAxis(), yAxis: { ...theme().yAxis, axisLabel: { ...theme().yAxis.axisLabel, formatter: '{value}' } }, series: seriesList };
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
        title: 'Layered views',
        subtitle: `${Array.from(selectedModes).map(id => views.find(v => v.id === id)?.label ?? id).join(' + ')} on one timeline`,
        option: multiOption ?? views[0].option,
      };

  const axisHint = CompatibilityEngine.generateAxisHint(activeDatasetMetadatas);

  /* ── Legend (FX chart legend: swatch + name, unit on the right) ── */
  const unitLabel = (() => {
    const hint = axisHint.toLowerCase();
    if (singleActiveId === 'valuation' || hint.includes('scatter') || hint.includes('x · gdp growth')) return 'Across: real GDP growth · Up: Buffett indicator';
    if (singleActiveId === 'ai-capital') return aiMode === 'intensity' ? 'AI VC as % of GDP · yearly' : 'US$ · yearly';
    if (singleActiveId === 'bubbles') return 'Each episode’s peak = 100';
    if (hint.includes('multi')) return 'Mixed units, each on its own scale · yearly';
    if (hint.includes('trillions')) return 'US$ trillions · yearly';
    if (hint.includes('% of gdp')) return '% of GDP · yearly';
    if (hint.includes('% annual')) return '% a year';
    if (hint.includes('index')) return 'First year = 100';
    return 'Yearly';
  })();

  const statusFor = (market: typeof visible[number]) =>
    activeDatasetMetadatas
      .map(dataset => {
        let vals: (number | null)[] = [];
        if (dataset.id === 'gdp') vals = valuesFor(market, 'gdp');
        else if (dataset.id === 'marketCap') vals = valuesFor(market, 'marketCap');
        else if (dataset.id === 'buffett') vals = valuesFor(market, 'buffettIndicator');
        else if (dataset.id === 'gdpGrowth') vals = valuesFor(market, 'gdpGrowth');
        if (!vals.some(v => v !== null)) return null;
        const result = AnalysisEngine.analyze(dataset, vals, market.country);
        return isMulti ? `${dataset.shortName} ${result.statusLabel.toLowerCase()}` : result.statusLabel.toLowerCase();
      })
      .filter((s): s is string => Boolean(s))
      .join(', ');

  const swatches = visible.map((market, index) => {
    const status = statusFor(market);
    return (
      <span key={market.country}>
        <i style={{ backgroundColor: colorFor(market.country, index) }} />
        {market.name}
        {status && <span className="legend-status">· {status}</span>}
      </span>
    );
  });

  const marketLegend = (
    <div className="legend">
      {swatches}
      {singleActiveId === 'buffett' && (
        <>
          <span><i className="band" style={{ backgroundColor: 'var(--ink2)' }} />10-year range (±2σ)</span>
          <span><i className="dash" style={{ color: 'var(--ink2)' }} />10-year average</span>
          <span><i className="dash" style={{ color: 'var(--axis)' }} />100% reference</span>
        </>
      )}
      <span className="legend-unit">{unitLabel}</span>
    </div>
  );

  const relativeLegend = (
    <div className="legend">
      {visible.map((market, index) => (
        <span key={market.country}>
          <i style={{ backgroundColor: colorFor(market.country, index) }} />
          {market.name}
        </span>
      ))}
      <span><i style={{ backgroundColor: 'var(--ink2)', height: 2 }} />GDP</span>
      <span><i className="dash" style={{ color: 'var(--ink2)' }} />Market value</span>
      <span className="legend-unit">{unitLabel}</span>
    </div>
  );

  const aiLegend = (
    <div className="legend" style={{ alignItems: 'center' }}>
      {aiVisible.map((market, index) => (
        <span key={market.country}>
          <i style={{ backgroundColor: colorFor(market.country, index) }} />
          {market.name}
        </span>
      ))}
      {aiMode === 'intensity' && <span><i className="dash" style={{ color: 'var(--ink2)' }} />5-year baseline</span>}
      <span className="legend-unit" style={{ gap: 10 }}>
        {unitLabel}
        <span className="seg" role="group" aria-label="AI measure">
          <button type="button" aria-pressed={aiMode === 'intensity'} onClick={() => setAiMode('intensity')}>AI VC / GDP</button>
          <button type="button" aria-pressed={aiMode === 'flow'} onClick={() => setAiMode('flow')}>Raw VC</button>
        </span>
      </span>
    </div>
  );

  const bubbleLegend = (
    <div className="legend">
      {BUBBLE_LIBRARY.filter(b => b.chart).map((bubble, index) => (
        <span key={bubble.id}>
          <i style={{ backgroundColor: palette[index % palette.length] }} />
          {bubble.name}
        </span>
      ))}
      <span className="legend-unit">{unitLabel}</span>
    </div>
  );

  const fetchedAgo = useRelative(initialData?.fetchedAt);

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

  const toolbar = <ModeToolbar views={views} selectedModes={selectedModes} onToggleMode={toggleMode} />;

  /* ── Error state (FX "state" page) ── */
  if (!initialData) {
    return (
      <main id="main-content" className="page">
        <div className="state fade-in" role="alert">
          <p className="state-code">Unavailable</p>
          <h1 className="state-title">The economic data didn’t load</h1>
          <p className="state-text">The World Bank’s data service didn’t answer. This is usually brief; try again in a moment.</p>
          <div className="state-actions">
            <button type="button" className="btn btn-primary" onClick={() => location.reload()}>
              Try again
            </button>
          </div>
        </div>
      </main>
    );
  }

  const missing = data.filter(c => c.records.length === 0).map(c => c.name);
  const focusData = visible.find(m => m.country === focus) ?? visible[0];
  const heroMarkets = visible.slice(0, 3);
  const extra = visible.length - heroMarkets.length;
  const latestGdp = (code: string) => {
    const r = [...(data.find(c => c.country === code)?.records ?? [])].reverse().find(x => x.gdp !== null);
    return r ? `${compactCurrency(r.gdp)} GDP` : 'No data';
  };
  const lede =
    visible.length === 1
      ? `${visible[0].name}, ${rangeStart}–${rangeEnd}: the size of the economy, the value of its stock market and the gap between them (the Buffett indicator), with AI venture capital and a library of past bubbles for context.`
      : `${visible.length} markets side by side, ${rangeStart}–${rangeEnd}: the size of each economy, the value of its stock market and the gap between them (the Buffett indicator), with AI venture capital and a library of past bubbles for context.`;

  /* ── Render ── */
  return (
    <main id="main-content" className="page">
      <StatusBar fetchedAt={initialData.fetchedAt} latestYear={latestYear} missing={missing} />

      <div className="fade-in">
        <TopBar count={selectedMarkets.length} onPick={() => setPickerOpen(true)} />

        <section className="hero" aria-labelledby="hero-title">
          <h1 id="hero-title" className={`hero-title${visible.length > 2 ? ' is-many' : ''}`}>
            {heroMarkets.map((market, index) => (
              <span key={market.country} className="hero-name">
                <MarketIcon code={market.country} size="0.8em" />
                <span>{market.name}</span>
                {index < heroMarkets.length - 1 && <span className="slash">/</span>}
              </span>
            ))}
            {extra > 0 && (
              <button type="button" className="hero-more" onClick={() => setPickerOpen(true)}>
                +{extra} more
              </button>
            )}
          </h1>
          <p className="hero-sub">{lede}</p>
          <Timeframe
            period={period}
            periods={PERIODS}
            onSelect={p => setPeriod(p)}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            allYears={allYears}
            draft={rangeDraft}
            onDraftOpen={openCustomRange}
            onPickPart={selectRangePart}
            rangeIsValid={rangeIsValid}
          />
        </section>

        {focusData && (
          <div key={`${focusData.country}-${rangeStart}-${rangeEnd}`} className="swap">
            <Brief market={focusData} rangeStart={rangeStart} rangeEnd={rangeEnd} multiple={visible.length > 1} />
          </div>
        )}

        <ChartPanel
          viewKey={currentView.id}
          title={currentView.title}
          subtitle={currentView.subtitle}
          option={currentView.option}
          short={selectedModes.has('valuation') && selectedModes.size === 1}
          legend={activeLegend}
          toolbar={toolbar}
          foot={
            <InsightBanner
              selectedModes={selectedModes}
              aiSourceName={initialAiCapitalFlow?.source.name}
              aiSourceUrl={initialAiCapitalFlow?.source.url}
              aiLatestYear={initialAiCapitalFlow?.source.latestObservationYear}
            />
          }
          empty={
            selectedModes.has('ai-capital') && !hasAiObservations ? (
              <div>
                <h3>No AI capital-flow data for these markets</h3>
                <p>
                  The source hasn’t published annual figures for this selection. Add the United States, the United Kingdom or
                  Japan to see the OECD baseline.
                </p>
                <button type="button" className="btn btn-sm" style={{ marginTop: 16 }} onClick={() => setPickerOpen(true)}>
                  Choose markets
                </button>
              </div>
            ) : undefined
          }
        />

        <MarketRows
          markets={visible}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          focus={focus}
          onFocus={setFocusMarket}
          onRemove={toggleMarket}
        />

        {selectedModes.has('ai-capital') && (
          <section className="card section fade-in" aria-labelledby="ai-title">
            <div className="card-head">
              <div>
                <h2 id="ai-title">AI capital flow</h2>
                <p>The latest annual observation for each selected market. Blank cells weren’t published, not zero.</p>
              </div>
            </div>
            <div className="scroll">
              <table className="t" style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <th>Market</th>
                    <th className="r">AI investment</th>
                    <th className="r">AI venture capital</th>
                    <th className="r">AI VC / GDP</th>
                    <th className="r">5-year growth a year</th>
                    <th className="r">Change on year</th>
                    <th className="r">Share of all VC</th>
                  </tr>
                </thead>
                <tbody>
                  {aiMetrics.map(({ market, index, current, aiToGdp, cagr }) => (
                    <tr key={market.country}>
                      <td>
                        <span className="cell-market strong">
                          <MarketIcon code={market.country} size={20} />
                          <span>
                            {market.name}
                            <span className="sub" style={{ fontWeight: 400 }}>
                              <i className="dot" style={{ backgroundColor: colorFor(market.country, index), width: 7, height: 7, marginRight: 6 }} />
                              {current?.year ?? 'No observation'}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="r">{compactCurrency(current?.aiInvestment ?? null)}</td>
                      <td className="r strong">{compactCurrency(current?.aiVentureCapitalInvestment ?? null)}</td>
                      <td className="r">{percent(aiToGdp, 2)}</td>
                      <td className="r">{percent(cagr, 1)}</td>
                      <td className="r">{percent(current?.aiInvestmentGrowth ?? null, 1)}</td>
                      <td className="r">{percent(current?.aiShareOfTotalVc ?? null, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {selectedModes.has('bubbles') && <BubbleLibrary bubbles={BUBBLE_LIBRARY} />}

        <DataSources aiSource={initialAiCapitalFlow?.source} />

        <ProjectArchitecture />

        <footer className="footer">
          <p>
            Economic data: World Bank World Development Indicators via the Data360 API{fetchedAgo ? `, fetched ${fetchedAgo}` : ''}.
            AI venture capital: {initialAiCapitalFlow?.source.name ?? 'OECD.AI'}. Bubble paths: the published sources listed with each episode.
          </p>
          <p className="muted">
            Annual figures in current US dollars unless a view says otherwise. Regional aggregates can have gaps. Charts drawn with{' '}
            <a href="https://www.tradingview.com/lightweight-charts/" target="_blank" rel="noreferrer">TradingView Lightweight Charts</a>.
          </p>
        </footer>
      </div>

      {pickerOpen && (
        <MarketPicker selected={selectedMarkets} onToggle={toggleMarket} onClose={() => setPickerOpen(false)} meta={latestGdp} />
      )}
    </main>
  );
}
