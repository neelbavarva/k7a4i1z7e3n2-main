'use client';

import { useEffect, useRef, useState } from 'react';
import { ColorType, CrosshairMode, LineSeries, LineStyle, LineType, createChart, type Time } from 'lightweight-charts';

type UnknownOption = Record<string, unknown>;
type SeriesOption = {
  name?: string;
  type?: string;
  data?: Array<number | null | [number, number]>;
  lineStyle?: { color?: string; width?: number; type?: string };
  itemStyle?: { color?: string };
  showSymbol?: boolean;
  stack?: string;
  silent?: boolean;
  smooth?: boolean | number;
  areaStyle?: { color?: string; opacity?: number };
  barMaxWidth?: number;
  markLine?: { data?: Array<{ yAxis?: number }>; lineStyle?: { color?: string; width?: number; type?: string } };
};
type TooltipRow = { id: string; name: string; color: string; value: number };
type AxisScale = { min: number; max: number; ticks: number[] };

const FONT = '"Roboto Mono", ui-monospace, monospace';
const chartColor = (series: SeriesOption) => series.lineStyle?.color ?? series.itemStyle?.color ?? '#2563c8';
const asYear = (time: unknown) => typeof time === 'string' ? time.slice(0, 4) : String(time);
const toTime = (year: string) => `${year}-01-01`;
// Units live in the compact axis hint above the canvas. Keep the canvas itself
// to uncluttered numbers, regardless of the active metric.
const numberFormat = (_option: UnknownOption, value: number) => {
  const absolute = Math.abs(value);
  const scaled = absolute >= 1e12 ? value / 1e12 : absolute >= 1e9 ? value / 1e9 : absolute >= 1e6 ? value / 1e6 : value;
  const decimals = Math.abs(scaled) >= 10 ? 0 : Math.abs(scaled) >= 1 ? 1 : 2;
  return Number(scaled.toFixed(decimals)).toLocaleString();
};
const niceStep = (value: number) => {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(value, 1e-9)));
  const fraction = value / magnitude;
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * magnitude;
};
const axisScaleFromValues = (values: number[]): AxisScale => {
  if (!values.length) return { min: 0, max: 1, ticks: [0, .25, .5, .75, 1] };
  const low = Math.min(...values), high = Math.max(...values), span = Math.max(high - low, Math.abs(high) * .08, 1e-6);
  const step = niceStep(span / 5);
  const min = Math.floor((low - span * .06) / step) * step;
  const max = Math.ceil((high + span * .06) / step) * step;
  const ticks: number[] = [];
  for (let value = min; value <= max + step * .001; value += step) ticks.push(Number(value.toPrecision(12)));
  return { min, max: max === min ? min + step : max, ticks };
};
const axisScaleFor = (series: SeriesOption[]): AxisScale => {
  // Stacked items are band helpers, not independent observations. Including
  // their raw range thickness in the scale collapses the visible Buffett
  // band toward zero; only their cumulative lower/upper values are real.
  const values = series.flatMap(item => item.stack ? [] : (item.data ?? []).flatMap(value => typeof value === 'number' && Number.isFinite(value) ? [value] : []));
  // ECharts accumulates stacked helper series. Include every cumulative point
  // so the Buffett lower + range band receives the same complete scale here.
  const stacks = new Map<string, SeriesOption[]>();
  series.forEach(item => { if (item.stack) stacks.set(item.stack, [...(stacks.get(item.stack) ?? []), item]); });
  stacks.forEach(items => {
    const longest = Math.max(...items.map(item => item.data?.length ?? 0), 0);
    for (let index = 0; index < longest; index++) {
      let cumulative = 0;
      items.forEach(item => {
        const value = item.data?.[index];
        if (typeof value === 'number' && Number.isFinite(value)) { cumulative += value; values.push(cumulative); }
      });
    }
  });
  return axisScaleFromValues(values);
};
const withOpacity = (color: string, opacity: number) => {
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    const value = Number.parseInt(color.slice(1), 16);
    return `rgba(${value >> 16}, ${(value >> 8) & 255}, ${value & 255}, ${opacity})`;
  }
  return color;
};

// Lightweight Charts' horizontal scale is time-based. Valuation is the one
// non-time-series view (GDP growth on X, Buffett on Y), so it is rendered by a
// tiny local SVG layer rather than reintroducing another charting dependency.
function ValuationScatter({ series }: { series: SeriesOption[] }) {
  const points = series.flatMap(item => (item.data ?? []).flatMap(point => Array.isArray(point) && point.length === 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]) ? [{ name: item.name ?? 'Market', color: chartColor(item), x: point[0], y: point[1] }] : []));
  const xValues = points.map(point => point.x);
  const yValues = points.map(point => point.y);
  // Match the legacy renderer's round-value axis rules instead of creating
  // another padded coordinate system for this numeric (non-time) view.
  const xAxis = axisScaleFromValues(xValues);
  const yAxis = axisScaleFromValues(yValues);
  const { min: minX, max: maxX } = xAxis;
  const { min: minY, max: maxY } = yAxis;
  const left = 52, right = 16, top = 14, bottom = 34, width = 1000 - left - right, height = 620 - top - bottom;
  const x = (value: number) => left + ((value - minX) / (maxX - minX)) * width;
  const y = (value: number) => top + (1 - (value - minY) / (maxY - minY)) * height;
  const zeroX = minX <= 0 && maxX >= 0 ? x(0) : null;
  const buffettReferenceY = minY <= 100 && maxY >= 100 ? y(100) : null;
  return <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 620" preserveAspectRatio="none" role="img" aria-label="Valuation versus economic growth scatter chart">
    {yAxis.ticks.map(value => <g key={`y-${value}`}><line x1={left} x2={1000 - right} y1={y(value)} y2={y(value)} stroke="#e7edf4" strokeDasharray="4 4" /><text x={left - 6} y={y(value) + 3} textAnchor="end" fill="#475569" fontFamily={FONT} fontSize="8">{value.toFixed(0)}%</text></g>)}
    {xAxis.ticks.map(value => <g key={`x-${value}`}><line x1={x(value)} x2={x(value)} y1={top} y2={top + height} stroke="#e7edf4" strokeDasharray="4 4" /><text x={x(value)} y={top + height + 14} textAnchor="middle" fill="#475569" fontFamily={FONT} fontSize="8">{value.toFixed(1)}%</text></g>)}
    {zeroX !== null && <line x1={zeroX} x2={zeroX} y1={top} y2={top + height} stroke="#64748b" strokeWidth="1.25" strokeDasharray="5 4" />}
    {buffettReferenceY !== null && <line x1={left} x2={1000 - right} y1={buffettReferenceY} y2={buffettReferenceY} stroke="#64748b" strokeWidth="1.25" strokeDasharray="5 4" />}
    {points.map((point, index) => <circle key={`${point.name}-${index}`} cx={x(point.x)} cy={y(point.y)} r="5" fill={point.color} fillOpacity=".9" stroke="#ffffff" strokeWidth="1.5"><title>{`${point.name}: GDP growth ${point.x.toFixed(2)}%, Buffett ${point.y.toFixed(1)}%`}</title></circle>)}
  </svg>;
}

/**
 * Lightweight Charts adapter. It intentionally accepts the dashboard's
 * existing option shape so the economic-data, timeframe, and legend layers do
 * not need to know which chart engine is active.
 */
export function LightweightChart({ option, className = '', resetKey = 0 }: { option: UnknownOption; className?: string; resetKey?: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const bandCanvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; year: string; rows: TooltipRow[] } | null>(null);
  const [ready, setReady] = useState(false);
  const series = ((option.series as SeriesOption[] | undefined) ?? []);
  const categories = (((option.xAxis as { data?: unknown[] } | undefined)?.data ?? []).map(String));
  const isValuationScatter = series.some(item => item.type === 'scatter');
  const axis = axisScaleFor(series.filter(item => item.type !== 'scatter'));
  // Dashboard controls intentionally create fresh option objects while a
  // filter menu opens or closes. Rebuild the chart only when its serializable
  // data/configuration actually changes, not for those unrelated UI renders.
  const optionFingerprint = JSON.stringify(option);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const sourceSeries = (option.series as SeriesOption[] | undefined) ?? [];
    const series = sourceSeries.filter(item => item.type !== 'scatter');
    const numericScatter = ((option.series as SeriesOption[] | undefined) ?? []).some(item => item.type === 'scatter');
    if (numericScatter) return;
    setReady(false);
    // Lightweight Charts guards its price scale at ±9.007e13. World market
    // capitalisation can exceed that in current USD, so scale only the values
    // sent to the renderer. Labels and tooltips always restore the source unit.
    const largestValue = Math.max(0, ...series.flatMap(item => (item.data ?? []).flatMap(value => typeof value === 'number' && Number.isFinite(value) ? [Math.abs(value)] : [])));
    const safeLimit = 9.0e13;
    const valueScale = largestValue > safeLimit ? 10 ** Math.ceil(Math.log10(largestValue / safeLimit)) : 1;

    const chart = createChart(host, {
      width: host.clientWidth,
      height: host.clientHeight,
      layout: { background: { type: ColorType.Solid, color: '#ffffff' }, textColor: '#475569', fontFamily: FONT, fontSize: 10 },
      grid: { vertLines: { color: '#dfe7f0', style: LineStyle.Dotted }, horzLines: { color: '#dfe7f0', style: LineStyle.Dotted } },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: '#94a3b8', style: LineStyle.Dashed, labelVisible: false }, horzLine: { color: '#94a3b8', style: LineStyle.Dashed, labelVisible: false } },
      rightPriceScale: { visible: false },
      leftPriceScale: { visible: false },
      timeScale: { visible: false, rightOffset: 0, barSpacing: 28, minBarSpacing: 0.5, maxBarSpacing: 1000, fixLeftEdge: false, fixRightEdge: false, timeVisible: false, tickMarkFormatter: (time: Time) => asYear(time) === categories[0] ? '' : asYear(time) },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
    });
    chartRef.current = chart;
    const metadata = new Map<unknown, { name: string; color: string; values: Map<string, number> }>();
    const lineByName = new Map<string, { priceToCoordinate: (price: number) => number | null }>();
    const barSeries: Array<{ color: string; values: Array<number | null>; line: { priceToCoordinate: (price: number) => number | null } }> = [];
    const areaSeries: Array<{ color: string; opacity: number; values: Array<number | null>; line: { priceToCoordinate: (price: number) => number | null } }> = [];

    for (const item of series) {
      // Anonymous stacked lines are the lower/range helpers for the Buffett
      // band; the matching raw line and dashed adaptive mean remain visible.
      if (!item.name && item.stack) continue;
      const color = chartColor(item);
      const isDashed = item.lineStyle?.type === 'dashed';
      const values = new Map<string, number>();
      const data = (item.data ?? []).flatMap((value, index) => {
        if (typeof value !== 'number' || !Number.isFinite(value) || !categories[index]) return [];
        const time = toTime(categories[index]);
        values.set(time, value);
        return [{ time, value: value / valueScale }];
      });
      const common = {
        priceScaleId: 'left' as const,
        lineWidth: Math.max(1, Math.min(4, item.lineStyle?.width ?? 2)) as 1 | 2 | 3 | 4,
        lineStyle: isDashed ? LineStyle.Dashed : LineStyle.Solid,
        lineType: item.smooth ? LineType.Curved : LineType.Simple,
        priceFormat: { type: 'custom' as const, formatter: (value: number) => numberFormat(option, value * valueScale), minMove: 0.000001 },
        autoscaleInfoProvider: () => ({ priceRange: { minValue: axis.min / valueScale, maxValue: axis.max / valueScale } }),
        crosshairMarkerVisible: Boolean(item.showSymbol),
        crosshairMarkerRadius: item.showSymbol ? 3 : 2,
        lastValueVisible: false,
        priceLineVisible: false,
      };
      const isBar = item.type === 'bar';
      const isArea = Boolean(item.areaStyle) && !isDashed && !isBar;
      // AreaSeries always includes a zero fill baseline in its autoscale
      // calculation. That compresses high-valued macro data and Buffett
      // bands, unlike the original scale:true chart. Render the same subtle
      // fill as an overlay while a LineSeries owns the true price scale.
      const line = chart.addSeries(LineSeries, { ...common, color: isBar ? 'rgba(0,0,0,0)' : color });
      // Growth keeps a transparent Lightweight line for shared scales,
        // crosshair and tooltips; its grouped annual bars are painted below.
      line.setData(data);
      const reference = item.markLine?.data?.find(point => typeof point.yAxis === 'number')?.yAxis;
      if (reference !== undefined) line.createPriceLine({ price: reference / valueScale, color: item.markLine?.lineStyle?.color ?? '#64748b', lineWidth: (item.markLine?.lineStyle?.width ?? 1) as 1 | 2 | 3 | 4, lineStyle: item.markLine?.lineStyle?.type === 'dashed' ? LineStyle.Dashed : LineStyle.Solid, axisLabelVisible: false, title: '' });
      // The unnamed stacked/helper series create the Buffett band. They are
      // intentionally not exposed as duplicate rows in the user tooltip.
      if (item.name) metadata.set(line, { name: item.name, color, values });
      if (item.name) lineByName.set(item.name, line);
      if (isBar) barSeries.push({ color, values: (item.data ?? []).map(value => typeof value === 'number' && Number.isFinite(value) ? value : null), line });
      if (isArea) areaSeries.push({ color: item.areaStyle?.color ?? color, opacity: item.areaStyle?.opacity ?? .045, values: (item.data ?? []).map(value => typeof value === 'number' && Number.isFinite(value) ? value : null), line });
    }

    // Recreate the existing Buffett mean ± standard-deviation band on a
    // transparent canvas above Lightweight Charts. The market series still
    // owns its price/time scales, so pan, zoom, and resize stay synchronized.
    const bands: Array<{ name: string; color: string; lower: Array<number | null>; range: Array<number | null> }> = [];
    let owner: { name: string; color: string } | null = null;
    for (const item of sourceSeries) {
      if (item.name && !item.stack) owner = { name: item.name, color: chartColor(item) };
      if (!item.stack || !owner) continue;
      const previous = bands.at(-1);
      if (previous && previous.name === owner.name && !previous.range.length) previous.range = (item.data ?? []).map(value => typeof value === 'number' ? value : null) as Array<number | null>;
      else bands.push({ name: owner.name, color: owner.color, lower: (item.data ?? []).map(value => typeof value === 'number' ? value : null) as Array<number | null>, range: [] });
    }
    const drawOverlays = () => {
      const canvas = bandCanvasRef.current;
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const width = host.clientWidth, height = host.clientHeight;
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      const context = canvas.getContext('2d');
      if (!context) return;
      context.scale(dpr, dpr); context.clearRect(0, 0, width, height);
      for (const area of areaSeries) {
        let segment: Array<[number, number]> = [];
        const fillSegment = () => {
          if (segment.length < 2) { segment = []; return; }
          context.beginPath(); context.moveTo(segment[0][0], height); segment.forEach(point => context.lineTo(point[0], point[1])); context.lineTo(segment.at(-1)![0], height); context.closePath(); context.fillStyle = withOpacity(area.color, area.opacity); context.fill(); segment = [];
        };
        area.values.forEach((value, index) => {
          if (value === null || !categories[index]) { fillSegment(); return; }
          const x = chart.timeScale().timeToCoordinate(toTime(categories[index]));
          const y = area.line.priceToCoordinate(value / valueScale);
          if (x === null || y === null) { fillSegment(); return; }
          segment.push([x, y]);
        });
        fillSegment();
      }
      for (const band of bands) {
        const line = lineByName.get(band.name);
        if (!line || !band.range.length) continue;
        const lower: Array<[number, number]> = [], upper: Array<[number, number]> = [];
        for (let index = 0; index < categories.length; index++) {
          const low = band.lower[index], range = band.range[index];
          if (low === null || low === undefined || range === null || range === undefined) continue;
          const x = chart.timeScale().timeToCoordinate(toTime(categories[index]));
          const lowY = line.priceToCoordinate(low / valueScale), highY = line.priceToCoordinate((low + range) / valueScale);
          if (x !== null && lowY !== null && highY !== null) { lower.push([x, lowY]); upper.push([x, highY]); }
        }
        if (lower.length < 2) continue;
        context.beginPath(); context.moveTo(lower[0][0], lower[0][1]); lower.slice(1).forEach(point => context.lineTo(point[0], point[1])); upper.reverse().forEach(point => context.lineTo(point[0], point[1])); context.closePath(); context.fillStyle = withOpacity(band.color, .18); context.fill();
      }
      // Render clearly visible data point markers (filled dots) along active series lines
      for (const [, meta] of metadata.entries()) {
        const line = lineByName.get(meta.name);
        if (!line) continue;
        context.fillStyle = meta.color;
        context.strokeStyle = '#ffffff';
        context.lineWidth = 1.5;
        for (let index = 0; index < categories.length; index++) {
          const time = toTime(categories[index]);
          const value = meta.values.get(time);
          if (value === undefined || value === null) continue;
          const x = chart.timeScale().timeToCoordinate(time);
          const y = line.priceToCoordinate(value / valueScale);
          if (x !== null && y !== null) {
            context.beginPath();
            context.arc(x, y, 3.5, 0, 2 * Math.PI);
            context.fill();
            context.stroke();
          }
        }
      }
      // Lightweight Charts deliberately keeps histogram columns centred on a
      // timestamp. The prior renderer uses grouped columns for each market;
      // retain that established growth encoding while keeping LWC responsible
      // for the actual time/price transforms and interaction.
      if (!barSeries.length) return;
      const zero = barSeries[0].line.priceToCoordinate(0);
      if (zero === null) return;
      const first = categories.length > 1 ? chart.timeScale().timeToCoordinate(toTime(categories[0])) : null;
      const second = categories.length > 1 ? chart.timeScale().timeToCoordinate(toTime(categories[1])) : null;
      const step = first !== null && second !== null ? Math.abs(second - first) : Math.max(20, width * .12);
      const barWidth = Math.min(16, Math.max(3, step / (barSeries.length + 2.25)));
      const groupWidth = barWidth * barSeries.length;
      barSeries.forEach((bar, marketIndex) => {
        bar.values.forEach((value, index) => {
          if (value === null || !categories[index]) return;
          const center = chart.timeScale().timeToCoordinate(toTime(categories[index]));
          const y = bar.line.priceToCoordinate(value / valueScale);
          if (center === null || y === null) return;
          const top = Math.min(y, zero), height = Math.abs(zero - y);
          const x = center - groupWidth / 2 + marketIndex * barWidth;
          context.fillStyle = bar.color;
          context.beginPath(); context.roundRect(x, top, barWidth - 1, Math.max(1, height), Math.min(3, barWidth / 2)); context.fill();
        });
      });
    };

    chart.timeScale().fitContent();
    // Set bar spacing from the actual plot width (not the outer card width),
    // making logical index 0 and the final logical index meet the two edges.
    const pinTimeRange = () => {
      if (categories.length > 1) {
        // Lightweight Charts centres the first/last bar by half a bar. Use the
        // canvas width plus a half-bar offset to pin those annual points to the
        // two plotting edges, matching the legacy renderer's coordinate model.
        chart.timeScale().setVisibleLogicalRange({ from: 0, to: categories.length - 1 });
        chart.timeScale().applyOptions({ barSpacing: host.clientWidth / (categories.length - 1), rightOffset: -0.5 });
      }
      drawOverlays();
      setReady(true);
    };
    const firstLayoutFrame = requestAnimationFrame(() => { secondLayoutFrame = requestAnimationFrame(pinTimeRange); });
    let secondLayoutFrame = 0;
    chart.timeScale().subscribeVisibleTimeRangeChange(drawOverlays);
    const formatter = (option.tooltip as { formatter?: unknown } | undefined)?.formatter;
    chart.subscribeCrosshairMove(parameter => {
      if (!parameter.point || !parameter.time || numericScatter) { setTooltip(null); return; }
      const key = String(parameter.time);
      const rows = [...metadata.values()].flatMap(meta => {
        const value = meta.values.get(key);
        return value === undefined ? [] : [{ id: `${meta.name}-${meta.color}`, name: meta.name, color: meta.color, value }];
      });
      if (!rows.length) { setTooltip(null); return; }
      setTooltip({ x: parameter.point.x, y: parameter.point.y, year: asYear(parameter.time), rows });
      void formatter; // Formatting belongs to the data layer; numeric values remain unrounded here.
    });
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) { chart.applyOptions({ width: entry.contentRect.width, height: entry.contentRect.height }); requestAnimationFrame(pinTimeRange); }
    });
    observer.observe(host);
    return () => {
      cancelAnimationFrame(firstLayoutFrame); cancelAnimationFrame(secondLayoutFrame);
      const canvas = bandCanvasRef.current;
      canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
      observer.disconnect(); chart.timeScale().unsubscribeVisibleTimeRangeChange(drawOverlays); chart.remove(); chartRef.current = null;
    };
  }, [optionFingerprint, resetKey]);

  return <div className={`relative box-border h-[620px] w-full bg-white ${className}`}>
    {isValuationScatter ? <ValuationScatter series={series} /> : <div className="box-border grid h-full w-full grid-cols-[21px_minmax(0,1fr)_21px] grid-rows-[minmax(0,1fr)_21px] pt-[21px]">
      <div className="relative col-start-1 row-start-1 font-mono text-[8px] text-slate-600" aria-hidden="true">{axis.ticks.map((tick, index) => { const isTop = index === axis.ticks.length - 1; return <span key={tick} className="absolute right-[2px]" style={{ bottom: `${((tick - axis.min) / (axis.max - axis.min)) * 100}%`, transform: isTop ? 'translateY(0)' : 'translateY(50%)' }}>{index === 0 ? '' : numberFormat(option, tick)}</span>; })}</div>
      <div className="relative col-start-2 row-start-1 overflow-hidden rounded-md border border-slate-200 bg-white">
        <div aria-label="Interactive economic chart" role="img" aria-busy={!ready} ref={hostRef} className="h-full w-full" />
        <canvas ref={bandCanvasRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-[5] h-full w-full" />
        {!ready && <div aria-hidden="true" className="absolute inset-0 animate-pulse bg-[linear-gradient(110deg,#fff_25%,#f8fafc_40%,#fff_55%)] bg-[length:220%_100%]" />}
        {tooltip && <div className="pointer-events-none absolute z-10 min-w-36 rounded-md border border-slate-200 bg-white px-2.5 py-2 font-mono text-[10px] text-slate-700 shadow-lg" style={{ left: Math.min(Math.max(8, tooltip.x + 12), 300), top: Math.max(8, tooltip.y - 12) }}><p className="mb-1 font-semibold text-slate-900">{tooltip.year}</p>{tooltip.rows.map(row => <p key={row.id} className="flex items-center justify-between gap-4"><span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: row.color }} />{row.name}</span><strong>{Number(row.value.toPrecision(7)).toLocaleString()}</strong></p>)}</div>}
      </div>
      <div className="relative col-start-2 row-start-2 font-mono text-[8px] text-slate-600" aria-hidden="true">{categories.map((year, index) => <span key={year} className="absolute top-1" style={{ left: `${categories.length > 1 ? (index / (categories.length - 1)) * 100 : 50}%`, transform: index === categories.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)' }}>{index === 0 ? '' : year}</span>)}</div>
    </div>}
  </div>;
}
