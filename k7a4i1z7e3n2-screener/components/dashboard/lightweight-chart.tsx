'use client';

import { useEffect, useRef, useState } from 'react';
import { ColorType, CrosshairMode, LineSeries, LineStyle, LineType, createChart } from 'lightweight-charts';

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

const FONT = '"Instrument Sans Variable", "Instrument Sans", system-ui, sans-serif';
const chartColor = (series: SeriesOption) => series.lineStyle?.color ?? series.itemStyle?.color ?? '#2563c8';
// Each category (usually a year, but any label works, e.g. years from a bubble's peak)
// gets its own evenly spaced time slot; labels are looked up from the slot.
const toTime = (index: number) => `${2000 + index}-01-01`;
// Units live in the compact axis hint above the canvas. Keep the canvas itself
// to uncluttered numbers, regardless of the active metric.
const numberFormat = (_option: UnknownOption, value: number) => {
  const absolute = Math.abs(value);
  const scaled = absolute >= 1e12 ? value / 1e12 : absolute >= 1e9 ? value / 1e9 : absolute >= 1e6 ? value / 1e6 : value;
  const decimals = Math.abs(scaled) >= 10 ? 0 : Math.abs(scaled) >= 1 ? 1 : 2;
  return Number(scaled.toFixed(decimals)).toLocaleString();
};
// Tooltip values keep their unit (the axis stays unit-free; the legend names the unit).
const formatValue = (format: unknown, value: number) => {
  const abs = Math.abs(value);
  const money = () => (abs >= 1e12 ? `$${(value / 1e12).toFixed(abs >= 1e13 ? 1 : 2)}T` : abs >= 1e9 ? `$${(value / 1e9).toFixed(1)}B` : abs >= 1e6 ? `$${(value / 1e6).toFixed(0)}M` : `$${Math.round(value).toLocaleString()}`);
  switch (format) {
    case 'usd': return money();
    case 'pct': return `${value.toFixed(1)}%`;
    case 'pct2': return `${value.toFixed(2)}%`;
    case 'index': return value.toFixed(1);
    default: return abs >= 1e6 ? money() : value.toFixed(1);
  }
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
  // padding never pushes a series that can't go negative (GDP, market value) below zero
  const min = low >= 0 ? Math.max(0, Math.floor((low - span * .06) / step) * step) : Math.floor((low - span * .06) / step) * step;
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
// non-time-series view (GDP growth across, Buffett up), so it is a small SVG
// drawn at the container's real pixel size: round dots, undistorted text.
function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setSize({ width: entry.contentRect.width, height: entry.contentRect.height }));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

function ValuationScatter({ series }: { series: SeriesOption[] }) {
  const [ref, { width: w, height: h }] = useSize<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const points = series.flatMap(item => (item.data ?? []).flatMap(point => Array.isArray(point) && point.length === 2 && Number.isFinite(point[0]) && Number.isFinite(point[1]) ? [{ name: item.name ?? 'Market', color: chartColor(item), x: point[0], y: point[1] }] : []));
  const xAxis = axisScaleFromValues(points.map(point => point.x));
  const yAxis = axisScaleFromValues(points.map(point => point.y));
  const top = 20, bottom = 28, pad = 8;
  const plotW = Math.max(1, w - pad * 2), plotH = Math.max(1, h - top - bottom);
  const x = (value: number) => pad + ((value - xAxis.min) / (xAxis.max - xAxis.min)) * plotW;
  const y = (value: number) => top + (1 - (value - yAxis.min) / (yAxis.max - yAxis.min)) * plotH;
  const active = hover === null ? null : points[hover];
  return (
    <div ref={ref} className="lc-scatter">
      {w > 0 && (
        <svg width={w} height={h} role="img" aria-label="Valuation versus economic growth scatter chart" onMouseLeave={() => setHover(null)}>
          {yAxis.ticks.map(value => (
            <g key={`y-${value}`}>
              <line x1={0} x2={w} y1={y(value)} y2={y(value)} stroke="#eaede4" />
              {value !== yAxis.ticks[0] && <text x={2} y={y(value) - 5} className="lc-svg-label">{value.toFixed(0)}%</text>}
            </g>
          ))}
          {xAxis.ticks.map(value => (
            <text key={`x-${value}`} x={x(value)} y={h - 8} textAnchor={value === xAxis.ticks[0] ? 'start' : value === xAxis.ticks.at(-1) ? 'end' : 'middle'} className="lc-svg-label">{value.toFixed(value % 1 === 0 ? 0 : 1)}%</text>
          ))}
          {xAxis.min <= 0 && xAxis.max >= 0 && <line x1={x(0)} x2={x(0)} y1={top} y2={top + plotH} stroke="#a3aa9f" strokeDasharray="4 4" />}
          {yAxis.min <= 100 && yAxis.max >= 100 && <line x1={0} x2={w} y1={y(100)} y2={y(100)} stroke="#a3aa9f" strokeDasharray="4 4" />}
          {points.map((point, index) => (
            <circle key={`${point.name}-${index}`} cx={x(point.x)} cy={y(point.y)} r={hover === index ? 7.5 : 5.5} fill={point.color} fillOpacity={hover === null || hover === index ? 0.9 : 0.35} stroke="#fbfcf8" strokeWidth="2" style={{ transition: 'r .15s, fill-opacity .15s' }} onMouseEnter={() => setHover(index)} />
          ))}
        </svg>
      )}
      {active && (
        <div className="tip lc-tip" style={{ left: x(active.x) > w / 2 ? undefined : x(active.x) + 14, right: x(active.x) > w / 2 ? w - x(active.x) + 14 : undefined, top: Math.max(8, y(active.y) - 30) }}>
          <div className="tip-time">{active.name}</div>
          <ul className="tip-list">
            <li><span>Real GDP growth</span><b>{active.x.toFixed(1)}%</b></li>
            <li><span>Buffett indicator</span><b>{active.y.toFixed(0)}%</b></li>
          </ul>
        </div>
      )}
    </div>
  );
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
  // Axis labels are DOM text positioned from the chart's own coordinates, so they
  // line up with the plotted values and follow zoom and drag.
  const [ticks, setTicks] = useState<{ width: number; x: { label: string; x: number }[]; y: { value: number; y: number }[] }>({ width: 0, x: [], y: [] });
  // Wait for the web fonts so nothing on the canvas is drawn in a fallback face.
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let live = true;
    const done = () => live && setFontsReady(true);
    if (typeof document === 'undefined' || !('fonts' in document)) { done(); return; }
    Promise.all([document.fonts.load('400 12px "Instrument Sans Variable"'), document.fonts.ready]).then(done, done);
    const fallback = setTimeout(done, 1500);
    return () => { live = false; clearTimeout(fallback); };
  }, []);
  const [ready, setReady] = useState(false);
  const series = ((option.series as SeriesOption[] | undefined) ?? []);
  const xAxisOption = option.xAxis as { data?: unknown[]; tipLabels?: string[] } | undefined;
  const categories = (xAxisOption?.data ?? []).map(String);
  const tipLabels = xAxisOption?.tipLabels;
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
    if (numericScatter || !fontsReady) return;
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
      layout: { background: { type: ColorType.Solid, color: 'rgba(0,0,0,0)' }, textColor: '#7c837a', fontFamily: FONT, fontSize: 12, attributionLogo: false },
      grid: { vertLines: { color: '#f0f2eb', style: LineStyle.Solid }, horzLines: { visible: false } },
      crosshair: { mode: CrosshairMode.Normal, vertLine: { color: '#a3aa9f', style: LineStyle.Dashed, labelVisible: false }, horzLine: { color: '#a3aa9f', style: LineStyle.Dashed, labelVisible: false } },
      rightPriceScale: { visible: false },
      leftPriceScale: { visible: false, scaleMargins: { top: 0.06, bottom: 0.04 } },
      timeScale: { visible: false, rightOffset: 0, barSpacing: 28, minBarSpacing: 0.5, maxBarSpacing: 1000, fixLeftEdge: false, fixRightEdge: false, timeVisible: false },
      // A plain wheel scrolls the page, as everywhere else on the site. Zoom is a pinch
      // (touch or trackpad) or ⌘/Ctrl + scroll, handled below; drag pans.
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: true },
    });
    chartRef.current = chart;
    // An invisible series holding every slot keeps the axis evenly spaced even where no
    // series has a value (sparse bubble paths, gaps in a market's history).
    const spine = chart.addSeries(LineSeries, { priceScaleId: 'left', color: 'rgba(0,0,0,0)', lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false, autoscaleInfoProvider: () => null });
    spine.setData(categories.map((_, index) => ({ time: toTime(index) })));
    const labelAt = new Map(categories.map((label, index) => [toTime(index), tipLabels?.[index] ?? label]));
    const metadata = new Map<unknown, { name: string; color: string; values: Map<string, number> }>();
    const lineByName = new Map<string, { priceToCoordinate: (price: number) => number | null }>();
    const barSeries: Array<{ color: string; values: Array<number | null>; line: { priceToCoordinate: (price: number) => number | null } }> = [];
    let firstLine: { priceToCoordinate: (price: number) => number | null } | null = null;
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
        const time = toTime(index);
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
      // a reference line with a single point would draw as a stray stub
      if (isDashed && item.silent && data.length < 2) continue;
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
      if (!firstLine) firstLine = line;
      const reference = item.markLine?.data?.find(point => typeof point.yAxis === 'number')?.yAxis;
      if (reference !== undefined) line.createPriceLine({ price: reference / valueScale, color: item.markLine?.lineStyle?.color ?? '#7c837a', lineWidth: (item.markLine?.lineStyle?.width ?? 1) as 1 | 2 | 3 | 4, lineStyle: item.markLine?.lineStyle?.type === 'dashed' ? LineStyle.Dashed : LineStyle.Solid, axisLabelVisible: false, title: '' });
      // The unnamed stacked/helper series create the Buffett band. They are
      // intentionally not exposed as duplicate rows in the user tooltip.
      // silent series are references (baselines, averages): no tooltip row, no point markers
      if (item.name && !item.silent) metadata.set(line, { name: item.name, color, values });
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
      const yTicks = firstLine ? axis.ticks.flatMap(value => {
        const y = firstLine!.priceToCoordinate(value / valueScale);
        return y === null || y < 14 || y > height - 2 ? [] : [{ value, y: Math.round(y) }];
      }) : [];
      const xTicks: { label: string; x: number }[] = [];
      let lastX = -Infinity;
      categories.forEach((label, index) => {
        const x = chart.timeScale().timeToCoordinate(toTime(index));
        if (x === null || x < -1 || x > width + 1) return;
        if (x - lastX >= 52) { xTicks.push({ label, x: Math.round(x) }); lastX = x; }
      });
      // always label the latest visible slot; drop its neighbour if they'd collide
      const lastIndex = categories.findLastIndex((_, index) => { const x = chart.timeScale().timeToCoordinate(toTime(index)); return x !== null && x >= -1 && x <= width + 1; });
      if (lastIndex >= 0 && xTicks.at(-1)?.label !== categories[lastIndex]) {
        const x = Math.round(chart.timeScale().timeToCoordinate(toTime(lastIndex)) ?? width);
        if (xTicks.length && x - xTicks.at(-1)!.x < 52) xTicks.pop();
        xTicks.push({ label: categories[lastIndex], x });
      }
      setTicks(prev => JSON.stringify(prev) === JSON.stringify({ width, x: xTicks, y: yTicks }) ? prev : { width, x: xTicks, y: yTicks });
      // A soft fill helps one or two lines; with more they stack into a muddy block, so skip it.
      for (const area of areaSeries.length <= 2 ? areaSeries : []) {
        let segment: Array<[number, number]> = [];
        // fill down to the zero line when it's on screen, otherwise to the bottom edge
        const zeroY = area.line.priceToCoordinate(0);
        const base = zeroY === null ? height : Math.min(height, Math.max(0, zeroY));
        const fillSegment = () => {
          if (segment.length < 2) { segment = []; return; }
          context.beginPath(); context.moveTo(segment[0][0], base); segment.forEach(point => context.lineTo(point[0], point[1])); context.lineTo(segment.at(-1)![0], base); context.closePath(); context.fillStyle = withOpacity(area.color, area.opacity); context.fill(); segment = [];
        };
        area.values.forEach((value, index) => {
          if (value === null || !categories[index]) { fillSegment(); return; }
          const x = chart.timeScale().timeToCoordinate(toTime(index));
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
          const x = chart.timeScale().timeToCoordinate(toTime(index));
          const lowY = line.priceToCoordinate(low / valueScale), highY = line.priceToCoordinate((low + range) / valueScale);
          if (x !== null && lowY !== null && highY !== null) { lower.push([x, lowY]); upper.push([x, highY]); }
        }
        if (lower.length < 2) continue;
        context.beginPath(); context.moveTo(lower[0][0], lower[0][1]); lower.slice(1).forEach(point => context.lineTo(point[0], point[1])); upper.reverse().forEach(point => context.lineTo(point[0], point[1])); context.closePath(); context.fillStyle = withOpacity(band.color, bands.length > 2 ? .08 : .18); context.fill();
      }
      // Render clearly visible data point markers (filled dots) along active series lines
      for (const [, meta] of metadata.entries()) {
        const line = lineByName.get(meta.name);
        if (!line || barSeries.some(bar => bar.line === line)) continue; // bars already mark their values
        context.fillStyle = meta.color;
        context.strokeStyle = '#fbfcf8';
        context.lineWidth = 1.5;
        for (let index = 0; index < categories.length; index++) {
          const time = toTime(index);
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
      const first = categories.length > 1 ? chart.timeScale().timeToCoordinate(toTime(0)) : null;
      const second = categories.length > 1 ? chart.timeScale().timeToCoordinate(toTime(1)) : null;
      const step = first !== null && second !== null ? Math.abs(second - first) : Math.max(20, width * .12);
      const barWidth = Math.min(16, Math.max(3, step / (barSeries.length + 2.25)));
      const groupWidth = barWidth * barSeries.length;
      barSeries.forEach((bar, marketIndex) => {
        bar.values.forEach((value, index) => {
          if (value === null || !categories[index]) return;
          const center = chart.timeScale().timeToCoordinate(toTime(index));
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
      try {
        chart.timeScale().fitContent();
        if (categories.length > 1 && host.clientWidth > 0) {
          // the same small inset on both sides, so end points aren't clipped
          const inset = 10;
          const n = categories.length - 1;
          const margin = (inset * n) / Math.max(1, host.clientWidth - inset * 2);
          // Logical ranges are measured to bar edges, half a step out from each point.
          // Lines sit 10px in from both sides; grouped bars keep that half step so the
          // first and last groups aren't clipped.
          if (barSeries.length) chart.timeScale().setVisibleLogicalRange({ from: -margin, to: n + margin });
          else chart.timeScale().setVisibleLogicalRange({ from: 0.5 - margin, to: n - 0.5 + margin });
        }
      } catch {
        try { chart.timeScale().fitContent(); } catch { /* ignore */ }
      }
      // the chart applies a new range on its next frame; draw overlays after it
      requestAnimationFrame(() => { drawOverlays(); setReady(true); });
    };
    const firstLayoutFrame = requestAnimationFrame(() => { secondLayoutFrame = requestAnimationFrame(pinTimeRange); });
    let secondLayoutFrame = 0;
    chart.timeScale().subscribeVisibleLogicalRangeChange(drawOverlays);
    const formatter = (option.tooltip as { formatter?: unknown } | undefined)?.formatter;
    chart.subscribeCrosshairMove(parameter => {
      if (!parameter.point || !parameter.time || numericScatter) { setTooltip(null); return; }
      const key = String(parameter.time);
      const rows = [...metadata.values()].flatMap(meta => {
        const value = meta.values.get(key);
        return value === undefined ? [] : [{ id: `${meta.name}-${meta.color}`, name: meta.name, color: meta.color, value }];
      });
      if (!rows.length) { setTooltip(null); return; }
      setTooltip({ x: parameter.point.x, y: parameter.point.y, year: labelAt.get(key) ?? key, rows });
      void formatter; // Formatting belongs to the data layer; numeric values remain unrounded here.
    });
    // ⌘/Ctrl + wheel, and trackpad pinch (which browsers report as ctrl + wheel), zoom
    // around the pointer. A plain wheel is left alone so the page scrolls.
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      const scale = chart.timeScale();
      const range = scale.getVisibleLogicalRange();
      if (!range) return;
      event.preventDefault();
      const factor = Math.min(1.5, Math.max(0.66, Math.exp(event.deltaY * 0.01)));
      const anchor = scale.coordinateToLogical(event.clientX - host.getBoundingClientRect().left) ?? (range.from + range.to) / 2;
      const from = anchor - (anchor - range.from) * factor, to = anchor + (range.to - anchor) * factor;
      if (to - from < 1.5 || to - from > categories.length * 4) return;
      scale.setVisibleLogicalRange({ from, to });
    };
    host.addEventListener('wheel', onWheel, { passive: false });
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) { chart.applyOptions({ width: entry.contentRect.width, height: entry.contentRect.height }); requestAnimationFrame(pinTimeRange); }
    });
    observer.observe(host);
    return () => {
      cancelAnimationFrame(firstLayoutFrame); cancelAnimationFrame(secondLayoutFrame);
      const canvas = bandCanvasRef.current;
      canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
      host.removeEventListener('wheel', onWheel);
      observer.disconnect(); chart.timeScale().unsubscribeVisibleLogicalRangeChange(drawOverlays); chart.remove(); chartRef.current = null;
    };
  }, [optionFingerprint, resetKey, fontsReady]);

  const valueFormat = (option as { valueFormat?: unknown }).valueFormat;
  const plotW = hostRef.current?.clientWidth ?? ticks.width;
  const plotH = hostRef.current?.clientHeight ?? 400;
  return (
    <div className={`lc ${className}`}>
      {isValuationScatter ? <ValuationScatter series={series} /> : <>
        <div className="lc-plot">
          <div className="lc-grid" aria-hidden="true">
            {ticks.y.map(tick => <span key={tick.value} className="lc-hline" style={{ top: tick.y }} />)}
          </div>
          <div aria-label="Interactive economic chart" role="img" aria-busy={!ready} ref={hostRef} className="lc-host" />
          <canvas ref={bandCanvasRef} aria-hidden="true" className="lc-canvas" />
          <div className="lc-ylabels" aria-hidden="true">
            {ticks.y.map(tick => <em key={tick.value} style={{ top: tick.y }}>{numberFormat(option, tick.value)}</em>)}
          </div>
          {!ready && <div aria-hidden="true" className="sk lc-sk" />}
          {tooltip && (
            <div className="tip lc-tip" style={{ left: tooltip.x > plotW / 2 ? undefined : tooltip.x + 16, right: tooltip.x > plotW / 2 ? plotW - tooltip.x + 16 : undefined, top: Math.max(8, Math.min(tooltip.y - 12, plotH - 48 - tooltip.rows.length * 22)) }}>
              <div className="tip-time">{tooltip.year}</div>
              <ul className="tip-list">{tooltip.rows.map((row, index) => <li key={`${row.id}-${index}`}><span><i className="dot" style={{ backgroundColor: row.color, width: 8, height: 8 }} />{row.name}</span><b>{formatValue(valueFormat, row.value)}</b></li>)}</ul>
            </div>
          )}
        </div>
        <div className="lc-x" aria-hidden="true">
          {ticks.x.map(tick => <span key={tick.label} style={{ left: tick.x, transform: tick.x < 24 ? 'none' : tick.x > ticks.width - 24 ? 'translateX(-100%)' : 'translateX(-50%)' }}>{tick.label}</span>)}
        </div>
      </>}
    </div>
  );
}
