import type { RelationshipStrategy } from '../strategies/RelationshipStrategy';
import type { DatasetPair, RelationshipQueryOptions, RelationshipResult } from '../types/Relationship';
import { CorrelationStrategy } from '../strategies/CorrelationStrategy';
import { RollingCorrelationStrategy } from '../strategies/RollingCorrelationStrategy';
import { LeadLagStrategy } from '../strategies/LeadLagStrategy';

export class RelationshipRegistry {
  private static strategies = new Map<string, RelationshipStrategy>();
  private static initialized = false;

  private static initialize(): void {
    if (this.initialized) return;
    this.registerStrategy(new CorrelationStrategy());
    this.registerStrategy(new RollingCorrelationStrategy());
    this.registerStrategy(new LeadLagStrategy());
    this.initialized = true;
  }

  public static registerStrategy(strategy: RelationshipStrategy): void {
    this.strategies.set(strategy.id, strategy);
  }

  public static unregisterStrategy(strategyId: string): void {
    this.strategies.delete(strategyId);
  }

  public static getStrategy(strategyId: string): RelationshipStrategy | undefined {
    this.initialize();
    return this.strategies.get(strategyId);
  }

  public static getStrategies(): RelationshipStrategy[] {
    this.initialize();
    return Array.from(this.strategies.values());
  }

  public static computeAllStrategies(
    pair: DatasetPair,
    options: RelationshipQueryOptions
  ): RelationshipResult[] {
    this.initialize();
    const results: RelationshipResult[] = [];
    this.strategies.forEach(strategy => {
      results.push(strategy.compute(pair, options));
    });
    return results;
  }
}
