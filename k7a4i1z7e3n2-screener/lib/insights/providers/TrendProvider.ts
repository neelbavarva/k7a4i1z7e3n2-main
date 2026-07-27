import type { InsightProvider } from './InsightProvider';
import type { Insight, InsightQueryOptions } from '../types/Insight';
import { DATASET_REGISTRY } from '@/lib/datasets/registry';
import { trendLine, movingAverage, mean } from '@/lib/analysis/statistics';


export class TrendProvider implements InsightProvider {
  public id = 'trend-provider';
  public name = 'Long-Term Trend Detector';

  public generateInsights(query?: InsightQueryOptions): Insight[] {
    const seriesMap = (query?.metadata?.seriesMap ?? {}) as Record<string, number[]>;
    const datasetIds = query?.datasetId
      ? [query.datasetId]
      : Object.keys(DATASET_REGISTRY);

    const insights: Insight[] = [];

    datasetIds.forEach(id => {
      const meta = DATASET_REGISTRY[id];
      if (!meta) return;

      const historicalValues = seriesMap[id];
      if (!historicalValues || historicalValues.length < 5) return;

      const { slope, rSquared } = trendLine(historicalValues);

      // Short-term vs long-term moving averages
      const shortWindow = Math.min(3, Math.floor(historicalValues.length / 4));
      const longWindow = Math.min(10, Math.floor(historicalValues.length / 2));
      const shortMA = movingAverage(historicalValues, shortWindow);
      const longMA = movingAverage(historicalValues, longWindow);

      const lastShort = shortMA[shortMA.length - 1];
      const lastLong = longMA[longMA.length - 1];
      const prevShort = shortMA[shortMA.length - 2];

      // Trend classification
      let trendLabel: string;
      let trendImportance: 1 | 2 | 3 | 4 | 5;
      let trendConfidence: 'high' | 'medium' | 'low';

      const avgValue = mean(historicalValues.filter(v => Number.isFinite(v)));
      const slopeRatio = avgValue !== 0 ? slope / avgValue : 0;

      if (Math.abs(slopeRatio) < 0.005) {
        trendLabel = 'stable';
        trendImportance = 2;
        trendConfidence = rSquared > 0.6 ? 'high' : 'medium';
      } else if (slope > 0) {
        const isAccelerating = lastShort !== null && prevShort !== null && lastShort > prevShort;
        trendLabel = isAccelerating ? 'accelerating rise' : 'long-term rise';
        trendImportance = isAccelerating ? 4 : 3;
        trendConfidence = rSquared > 0.7 ? 'high' : 'medium';
      } else {
        const isDecelerating = lastShort !== null && prevShort !== null && lastShort < prevShort;
        trendLabel = isDecelerating ? 'accelerating decline' : 'long-term decline';
        trendImportance = isDecelerating ? 5 : 3;
        trendConfidence = rSquared > 0.7 ? 'high' : 'medium';
      }

      // MA crossover signal
      const maCrossover = lastShort !== null && lastLong !== null && lastShort > lastLong;
      const crossoverNote = lastShort !== null && lastLong !== null
        ? ` Short-term MA (${shortWindow}Y) is ${maCrossover ? 'above' : 'below'} long-term MA (${longWindow}Y), signalling ${maCrossover ? 'bullish' : 'bearish'} momentum.`
        : '';

      insights.push({
        id: `insight-trend-${id}`,
        title: `${meta.shortName} Trend: ${trendLabel.replace(/\b\w/g, c => c.toUpperCase())}`,
        summary: `${meta.name} is in a ${trendLabel} regime (linear slope: ${slope > 0 ? '+' : ''}${slope.toFixed(3)} ${meta.unit}/yr, R²: ${rSquared.toFixed(2)}).${crossoverNote}`,
        significance: `The ${trendLabel} pattern in ${meta.name} represents a structural macro signal. R² of ${rSquared.toFixed(2)} indicates ${rSquared > 0.7 ? 'strong' : rSquared > 0.4 ? 'moderate' : 'weak'} fit to a linear trend model.`,
        confidence: trendConfidence,
        importance: trendImportance,
        relatedEvents: [],
        affectedDatasets: [id],
        tags: ['trend', trendLabel.split(' ')[0], meta.compatibilityGroup, rSquared > 0.7 ? 'strong-fit' : 'weak-fit'],
        references: [],
        metadata: {
          slope,
          rSquared,
          slopeRatio,
          trendLabel,
          maCrossover,
          shortMAWindow: shortWindow,
          longMAWindow: longWindow,
          providerId: this.id,
        },
      });
    });

    return insights;
  }
}
