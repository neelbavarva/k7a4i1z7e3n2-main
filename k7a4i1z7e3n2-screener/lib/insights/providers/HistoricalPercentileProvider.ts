import type { InsightProvider } from './InsightProvider';
import type { Insight, InsightQueryOptions } from '../types/Insight';
import { DATASET_REGISTRY } from '@/lib/datasets/registry';
import {
  mean,
  standardDeviation,
  percentile,
  quantile,
} from '@/lib/analysis/statistics';

/**
 * Generates percentile-position insights for every dataset.
 * Requires pre-computed series data supplied via query.metadata.seriesMap:
 *   Record<datasetId, number[]>
 * When series data is absent the provider silently skips the dataset.
 */
export class HistoricalPercentileProvider implements InsightProvider {
  public id = 'historical-percentile-provider';
  public name = 'Historical Percentile Provider';

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
      if (!historicalValues || historicalValues.length < 3) return;

      const latestValue = historicalValues[historicalValues.length - 1];
      const pctRank = percentile(historicalValues, latestValue);
      const p25 = quantile(historicalValues, 0.25);
      const p75 = quantile(historicalValues, 0.75);
      const avg = mean(historicalValues);
      const stdDev = standardDeviation(historicalValues);

      const isExtreme = pctRank >= 90 || pctRank <= 10;
      const isHigh = pctRank >= 75;
      const isLow = pctRank <= 25;

      const confidenceLevel = pctRank >= 90 || pctRank <= 10 ? 'high' as const
        : pctRank >= 70 || pctRank <= 30 ? 'medium' as const
        : 'low' as const;

      const directionLabel = isHigh ? 'elevated' : isLow ? 'depressed' : 'neutral';
      const importanceLevel = isExtreme ? 4 : isHigh || isLow ? 3 : 2;

      insights.push({
        id: `insight-percentile-${id}`,
        title: `${meta.shortName} at ${pctRank.toFixed(0)}th Percentile`,
        summary: `${meta.name} is currently at its ${pctRank.toFixed(0)}th historical percentile — ${directionLabel} relative to long-run norms. The 25th–75th percentile range is ${p25.toFixed(2)}–${p75.toFixed(2)} ${meta.unit}.`,
        significance: `Historical readings above the 90th or below the 10th percentile coincide with major macro regime transitions. A ${pctRank.toFixed(0)}th percentile reading${isExtreme ? ' is an extreme outlier requiring close monitoring' : ' remains within normal bounds'}.`,
        confidence: confidenceLevel,
        importance: importanceLevel as 1 | 2 | 3 | 4 | 5,
        relatedEvents: [],
        affectedDatasets: [id],
        tags: ['percentile', 'distribution', directionLabel, meta.compatibilityGroup],
        references: [],
        metadata: {
          pctRank,
          latestValue,
          mean: avg,
          stdDev,
          p25,
          p75,
          isExtreme,
          providerId: this.id,
        },
      });
    });

    return insights;
  }
}
