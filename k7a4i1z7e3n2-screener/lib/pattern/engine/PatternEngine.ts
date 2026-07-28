import type { PatternQueryOptions, PatternResult } from '../types/Pattern';
import { PatternRegistry } from '../registry/registry';

export class PatternEngine {
  private static cache = new Map<string, PatternResult>();

  public static clearCache(): void {
    this.cache.clear();
  }

  public static findPatterns(
    options?: PatternQueryOptions,
    strategyId?: string
  ): PatternResult {
    const targetStrategyId = strategyId ?? 'composite-similarity-strategy';
    const cacheKey = `${targetStrategyId}:${options?.currentYear ?? 2024}:${options?.windowSizeYears ?? 5}:${options?.limit ?? 5}:${options?.marketKey ?? 'default'}:${JSON.stringify(options?.weights ?? {})}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const strategy = PatternRegistry.getStrategy(targetStrategyId);

    if (!strategy) {
      throw new Error(`Pattern strategy '${targetStrategyId}' not found in PatternRegistry.`);
    }

    const result = strategy.findPatterns(options);
    this.cache.set(cacheKey, result);
    return result;
  }

  public static findPatternsAllStrategies(
    options?: PatternQueryOptions
  ): PatternResult[] {
    const strategies = PatternRegistry.getStrategies();
    return strategies.map(strategy =>
      this.findPatterns(options, strategy.id)
    );
  }

  public static getCachedPattern(id: string): PatternResult | null {
    for (const cached of this.cache.values()) {
      if (cached.id === id) return cached;
    }
    return null;
  }
}
