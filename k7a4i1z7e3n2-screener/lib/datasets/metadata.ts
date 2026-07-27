import type { AnalysisModelType } from '@/lib/analysis/types';

export type MeasurementUnit =
  | 'usd_trillion'
  | 'usd_billion'
  | 'percentage'
  | 'index'
  | 'ratio';

export type AxisType =
  | 'currency_large'    // USD Trillions
  | 'currency_small'    // USD Billions / Millions
  | 'percentage_small'  // Growth rates (-20% to +30%)
  | 'percentage_large'  // Ratios expressed as % (0% to 400%)
  | 'ratio'             // Raw ratio (0.0 to 5.0)
  | 'index'             // Base year = 100
  | 'scatter_bivariate';// Scatter (X, Y)

export type CompatibilityGroup =
  | 'macro_currency'    // Nominal GDP, Market Cap
  | 'valuation'         // Buffett Indicator, Valuation Scatter
  | 'growth'            // Real GDP Growth
  | 'technology'        // AI Venture Capital / Intensity
  | 'history'           // Bubble benchmarks
  | 'inflation'         // Future inflation datasets
  | 'labour'            // Future employment datasets
  | 'housing';          // Future housing datasets

export type SeriesRendererType = 'line' | 'bar' | 'scatter' | 'band_overlay';

export interface DatasetMetadata {
  id: string;
  name: string;
  shortName: string;
  unit: MeasurementUnit;
  axisType: AxisType;
  compatibilityGroup: CompatibilityGroup;
  renderer: SeriesRendererType;
  analysisModel?: AnalysisModelType;
  defaultVisible: boolean;
  supportsReferenceModel: boolean;
  supportsBubbleOverlay: boolean;
  supportsHistoricalContext?: boolean;
  supportsTooltip: boolean;
  supportsLegend: boolean;
  lineStyle?: 'solid' | 'dashed';
  hasAreaFill?: boolean;
  areaOpacity?: number;
  extractValue?: (record: any, extraData?: any) => number | null | [number, number];
  buildReferenceModel?: (values: (number | null)[], marketCountry: string, color: string, isMixed: boolean) => any[];
  markLine?: { data: Array<{ yAxis: number }>; lineStyle?: { color: string; type: string; width: number } };

  // Formatters driven by metadata
  formatValue: (value: number) => string;
  formatAxisTick: (value: number) => string;
}

export function formatByUnit(value: number, unit: MeasurementUnit): string {
  if (!Number.isFinite(value)) return '—';
  switch (unit) {
    case 'usd_trillion': return `$${value.toFixed(2)}T`;
    case 'usd_billion': return `$${value.toFixed(1)}B`;
    case 'percentage': return `${value.toFixed(1)}%`;
    case 'ratio': return value.toFixed(2);
    case 'index': return value.toFixed(1);
    default: return String(value);
  }
}

export function formatAxisTickByAxisType(value: number, axisType: AxisType): string {
  switch (axisType) {
    case 'currency_large': return `$${value}T`;
    case 'currency_small': return `$${value}B`;
    case 'percentage_small':
    case 'percentage_large': return `${value}%`;
    case 'ratio': return value.toFixed(1);
    case 'index': return String(value);
    case 'scatter_bivariate': return `${value}%`;
    default: return String(value);
  }
}
