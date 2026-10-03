import type { DatasetMetadata } from './metadata';
import type { EconomicRecord, AiCapitalFlowRecord } from '@/types/economics';
import { BUFFETT_BAND } from '@/lib/model';


export interface SeriesConfig {
  id?: string;
  name: string;
  type: string;
  data: Array<number | null | [number, number]>;
  lineStyle?: { color?: string; width?: number; type?: string; opacity?: number };
  itemStyle?: { color?: string; opacity?: number };
  areaStyle?: { opacity?: number; color?: string };
  smooth?: boolean | number;
  barMaxWidth?: number;
  stack?: string;
  silent?: boolean;
  tooltip?: { show?: boolean };
  bandOwner?: string;
  bandData?: { lower: Array<number | null>; range: Array<number | null>; mean: Array<number | null> };
  markLine?: { data: Array<{ yAxis: number }>; lineStyle?: { color?: string; type?: string; width?: number } };
  unit?: string;
  axisType?: string;
}

export function computeRollingBand(values: (number | null)[]) {
  return values.map((_, index) => {
    const window = values.slice(Math.max(0, index - BUFFETT_BAND.windowYears + 1), index + 1).filter((v): v is number => v !== null);
    if (!window.length) return { mean: null, lower: null, range: null };
    const mean = window.reduce((sum, v) => sum + v, 0) / window.length;
    const variance = window.reduce((sum, v) => sum + (v - mean) ** 2, 0) / window.length;
    const deviation = Math.sqrt(variance) * BUFFETT_BAND.deviations;
    return {
      mean,
      lower: Math.max(0, mean - deviation),
      range: deviation * 2,
    };
  });
}

export function computeIndexSeries(values: (number | null)[]) {
  const base = values.find((v): v is number => v !== null && v > 0);
  return values.map(v => (base && v !== null ? (v / base) * 100 : null));
}

export class CompatibilityEngine {
  static resolveCompatibility(datasets: DatasetMetadata[]) {
    const groups = new Set(datasets.map(d => d.compatibilityGroup));
    const axes = new Set(datasets.map(d => d.axisType));
    const isHomogeneous = groups.size <= 1;
    const hasMixedMetrics = !isHomogeneous;

    return {
      isHomogeneous,
      hasMixedMetrics,
      groups: Array.from(groups),
      axes: Array.from(axes),
    };
  }

  static generateAxisHint(datasets: DatasetMetadata[]): string {
    if (!datasets.length) return 'Y · value  |  X · year';
    const { isHomogeneous } = this.resolveCompatibility(datasets);

    if (!isHomogeneous) {
      return 'Y · multi-metric (indexed / % / $)  |  X · year';
    }

    const first = datasets[0];
    switch (first.axisType) {
      case 'currency_large':
        return 'Y · USD trillions  |  X · year';
      case 'currency_small':
        return 'Y · USD  |  X · year';
      case 'percentage_small':
        return 'Y · % annual  |  X · year';
      case 'percentage_large':
        return 'Y · % of GDP  |  X · year';
      case 'index':
        return 'Y · index  |  X · year';
      case 'scatter_bivariate':
        return 'X · GDP growth  |  Y · Buffett %';
      default:
        return 'Y · value  |  X · year';
    }
  }

  static buildSeriesForMarket(
    market: { country: string; name: string; records: EconomicRecord[] },
    datasets: DatasetMetadata[],
    years: number[],
    color: string,
    allMarkets: Array<{ country: string; name: string; records: EconomicRecord[] }>,
    aiVisible: Array<{ country: string; name: string; records: AiCapitalFlowRecord[] }>,
    aiYears: number[]
  ): SeriesConfig[] {
    const seriesList: SeriesConfig[] = [];
    const { hasMixedMetrics } = this.resolveCompatibility(datasets);
    const multiDatasets = datasets.length > 1;

    const byYear = new Map(market.records.map(r => [r.year, r]));
    const aiMarket = aiVisible.find(item => item.country === market.country);
    const aiByYear = new Map((aiMarket?.records ?? []).map(r => [r.year, r]));

    datasets.forEach(dataset => {
      const seriesName = multiDatasets ? `${market.name} ${dataset.shortName}` : market.name;

      if (dataset.renderer === 'scatter') {
        const points = market.records
          .map(r => dataset.extractValue ? dataset.extractValue(r) : null)
          .filter((pt): pt is [number, number] => Array.isArray(pt) && pt.length === 2 && typeof pt[0] === 'number' && typeof pt[1] === 'number');

        seriesList.push({
          id: `${market.country}-${dataset.id}`,
          name: market.name,
          type: 'scatter',
          itemStyle: { color },
          data: points,
          unit: dataset.unit,
          axisType: dataset.axisType,
        });
        return;
      }

      // every layered series shares the chart's year axis, so values must line up with
      // `years`; AI series simply have gaps where nothing was published
      const rawValues = years.map(y => {
        const rec = byYear.get(y);
        const aiRec = aiByYear.get(y);
        if (dataset.extractValue) {
          const val = dataset.extractValue(rec, aiRec);
          return typeof val === 'number' ? val : null;
        }
        return null;
      });

      // mixed units share one axis: every dollar series (GDP, market cap, AI VC) is indexed
      // to its first year in range = 100; percentages stay as they are
      const indexed = hasMixedMetrics && dataset.axisType.startsWith('currency');
      const data = indexed ? computeIndexSeries(rawValues) : rawValues;

      const ownerKey = `${dataset.id}-${market.country}`;

      seriesList.push({
        id: `${market.country}-${dataset.id}`,
        bandOwner: dataset.supportsReferenceModel ? ownerKey : undefined,
        name: seriesName,
        type: dataset.renderer,
        smooth: dataset.renderer === 'line' ? 0.32 : undefined,
        barMaxWidth: dataset.renderer === 'bar' ? 16 : undefined,
        lineStyle: { width: dataset.lineStyle === 'dashed' ? 2.2 : 2.6, color, type: dataset.lineStyle },
        itemStyle: { color },
        areaStyle: dataset.hasAreaFill ? { opacity: dataset.areaOpacity ?? 0.045 } : undefined,
        data,
        unit: dataset.unit,
        axisType: indexed ? 'index' : dataset.axisType,
        markLine: dataset.markLine,
      });

      if (dataset.supportsReferenceModel) {
        const band = computeRollingBand(rawValues);
        seriesList.push(
          // Lower band helper
          {
            bandOwner: ownerKey,
            name: '',
            type: 'line',
            stack: `band-${market.country}`,
            silent: true,
            tooltip: { show: false },
            lineStyle: { opacity: 0 },
            areaStyle: { opacity: 0 },
            data: band.map(p => p.lower),
          },
          // Range band helper (filled polygon canvas overlay)
          {
            bandOwner: ownerKey,
            name: '',
            type: 'line',
            stack: `band-${market.country}`,
            silent: true,
            tooltip: { show: false },
            lineStyle: { opacity: 0 },
            areaStyle: { color, opacity: 0.18 },
            data: band.map(p => p.range),
          },
          // Dashed mean center line
          {
            bandOwner: ownerKey,
            name: '',
            type: 'line',
            smooth: 0.4,
            silent: true,
            tooltip: { show: false },
            lineStyle: { color, width: 1.5, type: 'dashed' },
            data: band.map(p => p.mean),
          }
        );
      }
    });

    return seriesList;
  }
}
