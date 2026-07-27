import type { ComparisonStrategy } from './ComparisonStrategy';
import type {
  PeriodDefinition,
  ComparisonResult,
  DatasetComparison,
  PeriodStats,
  ComparisonQueryOptions,
} from '../types/Comparison';
import { DATASET_REGISTRY } from '@/lib/datasets/registry';
import { mean, standardDeviation, zScore } from '@/lib/analysis/statistics';

export class StatisticalComparisonStrategy implements ComparisonStrategy {
  public id = 'statistical-comparison-strategy';
  public name = 'Statistical Comparison Strategy';

  public compare(
    periodA: PeriodDefinition,
    periodB: PeriodDefinition,
    options?: ComparisonQueryOptions
  ): ComparisonResult {
    const seriesMap = (options?.metadata?.seriesMap ?? {}) as Record<string, number[]>;
    const yearsMap = (options?.metadata?.yearsMap ?? {}) as Record<string, number[]>;

    const targetDatasetIds = options?.datasetIds?.length
      ? options.datasetIds
      : Object.keys(DATASET_REGISTRY);

    const datasetComparisons: DatasetComparison[] = [];

    targetDatasetIds.forEach(datasetId => {
      const meta = DATASET_REGISTRY[datasetId];
      if (!meta) return;

      const series = seriesMap[datasetId];
      const years = yearsMap[datasetId];
      if (!series || !years || series.length < 2) return;

      // Extract slices for Period A
      const periodAValues = years
        .map((yr, i) => (yr >= periodA.startYear && yr <= periodA.endYear ? series[i] : null))
        .filter((v): v is number => v !== null && Number.isFinite(v));

      // Extract slices for Period B
      const periodBValues = years
        .map((yr, i) => (yr >= periodB.startYear && yr <= periodB.endYear ? series[i] : null))
        .filter((v): v is number => v !== null && Number.isFinite(v));

      if (!periodAValues.length || !periodBValues.length) return;

      const meanA = mean(periodAValues);
      const meanB = mean(periodBValues);
      const sdA = standardDeviation(periodAValues);
      const sdB = standardDeviation(periodBValues);
      const minA = Math.min(...periodAValues);
      const minB = Math.min(...periodBValues);
      const maxA = Math.max(...periodAValues);
      const maxB = Math.max(...periodBValues);
      const endA = periodAValues[periodAValues.length - 1];
      const endB = periodBValues[periodBValues.length - 1];

      const statsA: PeriodStats = { mean: meanA, min: minA, max: maxA, stdDev: sdA, endValue: endA };
      const statsB: PeriodStats = { mean: meanB, min: minB, max: maxB, stdDev: sdB, endValue: endB };

      const absDiff = meanB - meanA;
      const pctDiff = meanA !== 0 ? ((meanB - meanA) / Math.abs(meanA)) * 100 : 0;

      // Overall distribution z-score distance
      const overallMean = mean(series);
      const overallSd = standardDeviation(series);
      const zA = zScore(meanA, overallMean, overallSd);
      const zB = zScore(meanB, overallMean, overallSd);
      const zDist = Math.abs(zA - zB);

      const simScore = Math.round(Math.max(0, 100 - zDist * 25));
      const simLabel: 'high' | 'moderate' | 'low' =
        simScore >= 75 ? 'high' : simScore >= 50 ? 'moderate' : 'low';

      const significance = `During ${periodA.name}, ${meta.shortName} averaged ${meanA.toFixed(2)} ${meta.unit}, compared to ${meanB.toFixed(2)} ${meta.unit} during ${periodB.name} (${pctDiff >= 0 ? '+' : ''}${pctDiff.toFixed(1)}% shift). Z-score distance is ${zDist.toFixed(2)}.`;

      datasetComparisons.push({
        datasetId,
        datasetName: meta.name,
        unit: meta.unit,
        periodAStats: statsA,
        periodBStats: statsB,
        absoluteDifference: absDiff,
        percentageDifference: pctDiff,
        zScoreDistance: zDist,
        similarityScore: simScore,
        similarityLabel: simLabel,
        significance,
      });
    });

    const avgSim = datasetComparisons.length
      ? Math.round(datasetComparisons.reduce((acc, c) => acc + c.similarityScore, 0) / datasetComparisons.length)
      : 50;

    const overallLabel: 'high' | 'moderate' | 'low' =
      avgSim >= 75 ? 'high' : avgSim >= 50 ? 'moderate' : 'low';

    return {
      id: `comparison-stat-${periodA.id}-vs-${periodB.id}`,
      title: `Statistical Comparison: ${periodA.name} vs ${periodB.name}`,
      periodA,
      periodB,
      overallSimilarity: avgSim,
      similarityLabel: overallLabel,
      summary: `Comparative statistical analysis between ${periodA.name} (${periodA.startYear}–${periodA.endYear}) and ${periodB.name} (${periodB.startYear}–${periodB.endYear}) across ${datasetComparisons.length} datasets yields a ${avgSim}% overall similarity rating (${overallLabel}).`,
      datasetComparisons,
      relatedEvents: [periodA.eventId, periodB.eventId].filter((id): id is string => Boolean(id)),
      references: [],
      metadata: {
        strategyId: this.id,
      },
    };
  }
}
