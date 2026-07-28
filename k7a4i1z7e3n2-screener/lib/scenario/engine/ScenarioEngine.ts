import type {
  ScenarioInput,
  ScenarioHorizon,
  ScenarioQueryOptions,
  ScenarioResult,
} from '../types/Scenario';
import { ScenarioRegistry } from '../registry/registry';

export class ScenarioEngine {
  private static cache = new Map<string, ScenarioResult>();

  public static clearCache(): void {
    this.cache.clear();
  }

  public static simulateScenario(
    targetDatasetId: string,
    input: ScenarioInput,
    horizon: ScenarioHorizon,
    options?: ScenarioQueryOptions,
    strategyId?: string
  ): ScenarioResult {
    const targetStrategyId = strategyId ?? 'trend-projection-strategy';
    const cacheKey = `${targetDatasetId}:${input.datasetId}:${input.adjustmentType}:${input.adjustmentValue}:${horizon.startYear}-${horizon.endYear}:${targetStrategyId}:${options?.marketKey ?? 'default'}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const strategy = ScenarioRegistry.getStrategy(targetStrategyId);

    if (!strategy) {
      throw new Error(`Scenario strategy '${targetStrategyId}' not found in ScenarioRegistry.`);
    }

    const result = strategy.simulate(targetDatasetId, input, horizon, options);
    this.cache.set(cacheKey, result);
    return result;
  }

  public static simulateAllScenarios(
    targetDatasetId: string,
    input: ScenarioInput,
    horizon: ScenarioHorizon,
    options?: ScenarioQueryOptions
  ): ScenarioResult[] {
    const strategies = ScenarioRegistry.getStrategies();
    return strategies.map(strategy =>
      this.simulateScenario(targetDatasetId, input, horizon, options, strategy.id)
    );
  }

  public static getCachedScenario(id: string): ScenarioResult | null {
    for (const cached of this.cache.values()) {
      if (cached.id === id) return cached;
    }
    return null;
  }
}
