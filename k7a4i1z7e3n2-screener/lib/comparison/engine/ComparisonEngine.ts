import type {
  PeriodDefinition,
  ComparisonResult,
  DatasetComparison,
  ComparisonQueryOptions,
} from '../types/Comparison';
import { ComparisonRegistry } from '../registry/registry';

export class ComparisonEngine {
  private static cache = new Map<string, ComparisonResult>();

  public static clearCache(): void {
    this.cache.clear();
  }

  public static comparePeriods(
    periodA: PeriodDefinition,
    periodB: PeriodDefinition,
    options?: ComparisonQueryOptions,
    strategyId?: string
  ): ComparisonResult {
    const cacheKey = `${periodA.id}:${periodB.id}:${strategyId ?? 'default'}:${JSON.stringify(options ?? {})}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const strategy = strategyId
      ? ComparisonRegistry.getStrategy(strategyId)
      : ComparisonRegistry.getStrategies()[0];

    if (!strategy) {
      throw new Error(`Comparison strategy '${strategyId ?? 'default'}' not found.`);
    }

    const result = strategy.compare(periodA, periodB, options);
    this.cache.set(cacheKey, result);
    return result;
  }

  public static compareDataset(
    periodA: PeriodDefinition,
    periodB: PeriodDefinition,
    datasetId: string,
    options?: ComparisonQueryOptions
  ): DatasetComparison | null {
    const result = this.comparePeriods(periodA, periodB, {
      ...options,
      datasetIds: [datasetId],
    });
    return result.datasetComparisons.find(dc => dc.datasetId === datasetId) ?? null;
  }

  public static compareDatasets(
    periodA: PeriodDefinition,
    periodB: PeriodDefinition,
    datasetIds: string[],
    options?: ComparisonQueryOptions
  ): DatasetComparison[] {
    const result = this.comparePeriods(periodA, periodB, {
      ...options,
      datasetIds,
    });
    return result.datasetComparisons;
  }

  public static getComparison(id: string): ComparisonResult | null {
    for (const cached of this.cache.values()) {
      if (cached.id === id) return cached;
    }
    return null;
  }

  public static getComparisonSummary(result: ComparisonResult): string {
    return result.summary;
  }
}
