import type { DatasetMetadata } from '../datasets/metadata';
import type { AnalysisModelType, AnalysisResult } from './types';
import {
  mean,
  standardDeviation,
  zScore as calcZScore,
  trendLine,
  percentile as calcPercentile,
  movingAverage,
} from './statistics';
import { BUFFETT_BAND, GROWTH_STATUS, TREND_BAND_PCT, VALUATION_Z } from '@/lib/model';

export class AnalysisEngine {
  private static cache = new Map<string, AnalysisResult>();

  static analyze(dataset: DatasetMetadata, values: (number | null)[], marketKey = 'default'): AnalysisResult {
    const validValues = values.filter((v): v is number => v !== null && Number.isFinite(v));
    const lastValue = validValues.length ? validValues[validValues.length - 1] : null;

    const cacheKey = `${dataset.id}-${marketKey}-${values.length}-${lastValue}-${dataset.analysisModel ?? 'default'}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const modelType: AnalysisModelType = dataset.analysisModel ?? (
      dataset.supportsReferenceModel ? 'valuation_band' :
      dataset.renderer === 'bar' ? 'rolling_average' :
      dataset.renderer === 'scatter' ? 'percentile' :
      dataset.compatibilityGroup === 'macro_currency' ? 'trend' : 'percentile'
    );

    let result: AnalysisResult;

    switch (modelType) {
      case 'trend':
        result = this.analyzeTrend(dataset, values, validValues, lastValue);
        break;
      case 'valuation_band':
        result = this.analyzeValuationBand(dataset, values, validValues, lastValue);
        break;
      case 'rolling_average':
        result = this.analyzeRollingAverage(dataset, values, validValues, lastValue);
        break;
      case 'percentile':
        result = this.analyzePercentile(dataset, validValues, lastValue);
        break;
      case 'deviation':
        result = this.analyzeDeviation(dataset, validValues, lastValue);
        break;
      default:
        result = this.analyzeTrend(dataset, values, validValues, lastValue);
        break;
    }

    this.cache.set(cacheKey, result);
    return result;
  }

  private static analyzeTrend(
    dataset: DatasetMetadata,
    values: (number | null)[],
    validValues: number[],
    lastValue: number | null
  ): AnalysisResult {
    if (!validValues.length || lastValue === null) {
      return this.emptyResult(dataset.id, 'trend');
    }

    const { trendValues, slope, rSquared } = trendLine(values);
    const lastTrendValue = trendValues.length ? trendValues[trendValues.length - 1] : null;

    let devPct: number | null = null;
    if (lastTrendValue !== null && lastTrendValue !== 0) {
      devPct = ((lastValue - lastTrendValue) / Math.abs(lastTrendValue)) * 100;
    }

    const pctRank = calcPercentile(validValues, lastValue);
    const direction: 'up' | 'down' | 'flat' = slope > 0.01 ? 'up' : slope < -0.01 ? 'down' : 'flat';
    const strength: 'strong' | 'moderate' | 'weak' = rSquared > 0.7 ? 'strong' : rSquared > 0.3 ? 'moderate' : 'weak';

    let statusLabel = 'At Trend';
    if (devPct !== null) {
      if (devPct > TREND_BAND_PCT) statusLabel = `Above Trend (+${devPct.toFixed(1)}%)`;
      else if (devPct < -TREND_BAND_PCT) statusLabel = `Below Trend (${devPct.toFixed(1)}%)`;
    }

    return {
      datasetId: dataset.id,
      analysisType: 'trend',
      currentValue: lastValue,
      referenceValue: lastTrendValue,
      distanceFromReference: devPct,
      percentileRank: Number(pctRank.toFixed(0)),
      zScore: Number(calcZScore(lastValue, mean(validValues), standardDeviation(validValues)).toFixed(2)),
      statusLabel,
      trendDirection: direction,
      trendStrength: strength,
      summary: `Current value is ${devPct !== null ? (devPct >= 0 ? `+${devPct.toFixed(1)}%` : `${devPct.toFixed(1)}%`) : '0%'} relative to long-term trend line (${pctRank.toFixed(0)}th percentile).`,
      confidence: rSquared > 0.5 ? 'high' : 'medium',
      metrics: { slope, rSquared, devPct },
    };
  }

  private static analyzeValuationBand(
    dataset: DatasetMetadata,
    values: (number | null)[],
    validValues: number[],
    lastValue: number | null
  ): AnalysisResult {
    if (!validValues.length || lastValue === null) {
      return this.emptyResult(dataset.id, 'valuation_band');
    }

    const window = validValues.slice(Math.max(0, validValues.length - BUFFETT_BAND.windowYears));
    const avg = mean(window);
    const stdDev = standardDeviation(window);
    const z = calcZScore(lastValue, avg, stdDev);
    const pctRank = calcPercentile(validValues, lastValue);

    let statusLabel = 'Fair Value';
    if (z > VALUATION_Z.extreme) statusLabel = 'Extreme Overvaluation';
    else if (z > VALUATION_Z.stretched) statusLabel = 'Overvalued';
    else if (z < -VALUATION_Z.extreme) statusLabel = 'Extreme Undervaluation';
    else if (z < -VALUATION_Z.stretched) statusLabel = 'Undervalued';

    const diff = lastValue - avg;

    return {
      datasetId: dataset.id,
      analysisType: 'valuation_band',
      currentValue: lastValue,
      referenceValue: avg,
      distanceFromReference: Number(diff.toFixed(2)),
      percentileRank: Number(pctRank.toFixed(0)),
      zScore: Number(z.toFixed(2)),
      statusLabel,
      summary: `Valuation is currently ${statusLabel.toLowerCase()} (Z-score: ${z.toFixed(2)}, ${pctRank.toFixed(0)}th percentile).`,
      confidence: 'high',
      metrics: { mean: avg, stdDev, zScore: z },
    };
  }

  private static analyzeRollingAverage(
    dataset: DatasetMetadata,
    values: (number | null)[],
    validValues: number[],
    lastValue: number | null
  ): AnalysisResult {
    if (!validValues.length || lastValue === null) {
      return this.emptyResult(dataset.id, 'rolling_average');
    }

    const ma = movingAverage(values, GROWTH_STATUS.windowYears);
    const lastMa = ma.length ? ma[ma.length - 1] : null;
    const diff = lastMa !== null ? lastValue - lastMa : null;
    const pctRank = calcPercentile(validValues, lastValue);

    const prevValue = validValues.length > 1 ? validValues[validValues.length - 2] : lastValue;
    const change = lastValue - prevValue;
    const direction: 'up' | 'down' | 'flat' = change > 0.1 ? 'up' : change < -0.1 ? 'down' : 'flat';

    let statusLabel = 'Stable';
    if (diff !== null && diff > GROWTH_STATUS.deadBandPts) statusLabel = `Accelerating (+${diff.toFixed(1)}% vs 5Y avg)`;
    else if (diff !== null && diff < -GROWTH_STATUS.deadBandPts) statusLabel = `Decelerating (${diff.toFixed(1)}% vs 5Y avg)`;

    return {
      datasetId: dataset.id,
      analysisType: 'rolling_average',
      currentValue: lastValue,
      referenceValue: lastMa,
      distanceFromReference: diff !== null ? Number(diff.toFixed(2)) : null,
      percentileRank: Number(pctRank.toFixed(0)),
      zScore: Number(calcZScore(lastValue, mean(validValues), standardDeviation(validValues)).toFixed(2)),
      statusLabel,
      trendDirection: direction,
      summary: `Growth is currently ${statusLabel.toLowerCase()} relative to its 5-year moving average.`,
      confidence: 'high',
      metrics: { rollingAvg5Y: lastMa, diff },
    };
  }

  private static analyzePercentile(
    dataset: DatasetMetadata,
    validValues: number[],
    lastValue: number | null
  ): AnalysisResult {
    if (!validValues.length || lastValue === null) {
      return this.emptyResult(dataset.id, 'percentile');
    }

    const pctRank = calcPercentile(validValues, lastValue);
    const avg = mean(validValues);
    const stdDev = standardDeviation(validValues);
    const z = calcZScore(lastValue, avg, stdDev);

    const statusLabel = `${Math.round(pctRank)}th Percentile`;

    return {
      datasetId: dataset.id,
      analysisType: 'percentile',
      currentValue: lastValue,
      referenceValue: avg,
      distanceFromReference: Number((lastValue - avg).toFixed(2)),
      percentileRank: Number(pctRank.toFixed(0)),
      zScore: Number(z.toFixed(2)),
      statusLabel,
      summary: `Observation ranks at the ${Math.round(pctRank)}th percentile across historical records.`,
      confidence: 'high',
      metrics: { percentile: pctRank, mean: avg },
    };
  }

  private static analyzeDeviation(
    dataset: DatasetMetadata,
    validValues: number[],
    lastValue: number | null
  ): AnalysisResult {
    if (!validValues.length || lastValue === null) {
      return this.emptyResult(dataset.id, 'deviation');
    }

    const avg = mean(validValues);
    const stdDev = standardDeviation(validValues);
    const z = calcZScore(lastValue, avg, stdDev);
    const pctRank = calcPercentile(validValues, lastValue);

    const statusLabel = `${z >= 0 ? '+' : ''}${z.toFixed(1)} σ`;

    return {
      datasetId: dataset.id,
      analysisType: 'deviation',
      currentValue: lastValue,
      referenceValue: avg,
      distanceFromReference: Number((lastValue - avg).toFixed(2)),
      percentileRank: Number(pctRank.toFixed(0)),
      zScore: Number(z.toFixed(2)),
      statusLabel,
      summary: `Current observation deviates by ${z.toFixed(1)} standard deviations from the historical mean.`,
      confidence: 'high',
      metrics: { mean: avg, stdDev, zScore: z },
    };
  }

  private static emptyResult(datasetId: string, type: AnalysisModelType): AnalysisResult {
    return {
      datasetId,
      analysisType: type,
      currentValue: null,
      referenceValue: null,
      distanceFromReference: null,
      percentileRank: null,
      zScore: null,
      statusLabel: 'No Data',
      summary: 'Insufficient historical data for statistical analysis.',
      confidence: 'low',
    };
  }
}
