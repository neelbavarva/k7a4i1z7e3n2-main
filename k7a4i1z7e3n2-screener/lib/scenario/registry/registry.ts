import type { ScenarioStrategy } from '../strategies/ScenarioStrategy';
import type {
  ScenarioInput,
  ScenarioHorizon,
  ScenarioQueryOptions,
  ScenarioResult,
} from '../types/Scenario';
import { TrendProjectionStrategy } from '../strategies/TrendProjectionStrategy';
import { RelationshipProjectionStrategy } from '../strategies/RelationshipProjectionStrategy';
import { HistoricalProjectionStrategy } from '../strategies/HistoricalProjectionStrategy';

export class ScenarioRegistry {
  private static strategies = new Map<string, ScenarioStrategy>();
  private static initialized = false;

  private static initialize(): void {
    if (this.initialized) return;
    this.registerStrategy(new TrendProjectionStrategy());
    this.registerStrategy(new RelationshipProjectionStrategy());
    this.registerStrategy(new HistoricalProjectionStrategy());
    this.initialized = true;
  }

  public static registerStrategy(strategy: ScenarioStrategy): void {
    this.strategies.set(strategy.id, strategy);
  }

  public static unregisterStrategy(strategyId: string): void {
    this.strategies.delete(strategyId);
  }

  public static getStrategy(strategyId: string): ScenarioStrategy | undefined {
    this.initialize();
    return this.strategies.get(strategyId);
  }

  public static getStrategies(): ScenarioStrategy[] {
    this.initialize();
    return Array.from(this.strategies.values());
  }

  public static simulateAllStrategies(
    targetDatasetId: string,
    input: ScenarioInput,
    horizon: ScenarioHorizon,
    options?: ScenarioQueryOptions
  ): ScenarioResult[] {
    this.initialize();
    const results: ScenarioResult[] = [];
    this.strategies.forEach(strategy => {
      results.push(strategy.simulate(targetDatasetId, input, horizon, options));
    });
    return results;
  }
}
