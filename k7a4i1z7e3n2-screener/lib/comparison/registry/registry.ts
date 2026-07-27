import type { ComparisonStrategy } from '../strategies/ComparisonStrategy';
import type { PeriodDefinition, ComparisonResult, ComparisonQueryOptions } from '../types/Comparison';
import { StatisticalComparisonStrategy } from '../strategies/StatisticalComparisonStrategy';
import { HistoricalEventComparisonStrategy } from '../strategies/HistoricalEventComparisonStrategy';
import { PeriodComparisonStrategy } from '../strategies/PeriodComparisonStrategy';

export class ComparisonRegistry {
  private static strategies = new Map<string, ComparisonStrategy>();
  private static initialized = false;

  private static initialize(): void {
    if (this.initialized) return;
    this.registerStrategy(new StatisticalComparisonStrategy());
    this.registerStrategy(new HistoricalEventComparisonStrategy());
    this.registerStrategy(new PeriodComparisonStrategy());
    this.initialized = true;
  }

  public static registerStrategy(strategy: ComparisonStrategy): void {
    this.strategies.set(strategy.id, strategy);
  }

  public static unregisterStrategy(strategyId: string): void {
    this.strategies.delete(strategyId);
  }

  public static getStrategy(strategyId: string): ComparisonStrategy | undefined {
    this.initialize();
    return this.strategies.get(strategyId);
  }

  public static getStrategies(): ComparisonStrategy[] {
    this.initialize();
    return Array.from(this.strategies.values());
  }

  public static queryAllStrategies(
    periodA: PeriodDefinition,
    periodB: PeriodDefinition,
    options?: ComparisonQueryOptions
  ): ComparisonResult[] {
    this.initialize();
    const results: ComparisonResult[] = [];
    this.strategies.forEach(strategy => {
      results.push(strategy.compare(periodA, periodB, options));
    });
    return results;
  }
}
