import type {
  DatasetPair,
  RelationshipQueryOptions,
  RelationshipResult,
} from '../types/Relationship';
import { RelationshipRegistry } from '../registry/registry';

export class RelationshipEngine {
  private static cache = new Map<string, RelationshipResult>();

  public static clearCache(): void {
    this.cache.clear();
  }

  public static analyzeRelationship(
    pair: DatasetPair,
    options: RelationshipQueryOptions,
    strategyId?: string
  ): RelationshipResult {
    const targetStrategyId = strategyId ?? 'correlation-strategy';
    const cacheKey = `${pair.datasetIdA}:${pair.datasetIdB}:${targetStrategyId}:${JSON.stringify(
      options.timeRange ?? {}
    )}:${options.windowSize ?? 10}:${options.maxLag ?? 5}:${options.seriesA?.length ?? 0}:${options.seriesB?.length ?? 0}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const strategy = RelationshipRegistry.getStrategy(targetStrategyId);

    if (!strategy) {
      throw new Error(`Relationship strategy '${targetStrategyId}' not found in RelationshipRegistry.`);
    }

    const result = strategy.compute(pair, options);
    this.cache.set(cacheKey, result);
    return result;
  }

  public static analyzeAllRelationships(
    pair: DatasetPair,
    options: RelationshipQueryOptions
  ): RelationshipResult[] {
    const strategies = RelationshipRegistry.getStrategies();
    return strategies.map(strategy =>
      this.analyzeRelationship(pair, options, strategy.id)
    );
  }

  public static getCachedRelationship(id: string): RelationshipResult | null {
    for (const cached of this.cache.values()) {
      if (cached.id === id) return cached;
    }
    return null;
  }
}
