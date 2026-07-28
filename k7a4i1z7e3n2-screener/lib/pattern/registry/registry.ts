import type { PatternStrategy } from '../strategies/PatternStrategy';
import type { PatternQueryOptions, PatternResult } from '../types/Pattern';
import { CompositeSimilarityStrategy } from '../strategies/CompositeSimilarityStrategy';
import { WeightedSimilarityStrategy } from '../strategies/WeightedSimilarityStrategy';
import { HistoricalPatternStrategy } from '../strategies/HistoricalPatternStrategy';

export class PatternRegistry {
  private static strategies = new Map<string, PatternStrategy>();
  private static initialized = false;

  private static initialize(): void {
    if (this.initialized) return;
    this.registerStrategy(new CompositeSimilarityStrategy());
    this.registerStrategy(new WeightedSimilarityStrategy());
    this.registerStrategy(new HistoricalPatternStrategy());
    this.initialized = true;
  }

  public static registerStrategy(strategy: PatternStrategy): void {
    this.strategies.set(strategy.id, strategy);
  }

  public static unregisterStrategy(strategyId: string): void {
    this.strategies.delete(strategyId);
  }

  public static getStrategy(strategyId: string): PatternStrategy | undefined {
    this.initialize();
    return this.strategies.get(strategyId);
  }

  public static getStrategies(): PatternStrategy[] {
    this.initialize();
    return Array.from(this.strategies.values());
  }

  public static findPatternsAllStrategies(options?: PatternQueryOptions): PatternResult[] {
    this.initialize();
    const results: PatternResult[] = [];
    this.strategies.forEach(strategy => {
      results.push(strategy.findPatterns(options));
    });
    return results;
  }
}
