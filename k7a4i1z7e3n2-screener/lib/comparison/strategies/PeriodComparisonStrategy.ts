import type { ComparisonStrategy } from './ComparisonStrategy';
import type {
  PeriodDefinition,
  ComparisonResult,
  ComparisonQueryOptions,
} from '../types/Comparison';
import { StatisticalComparisonStrategy } from './StatisticalComparisonStrategy';

export class PeriodComparisonStrategy implements ComparisonStrategy {
  public id = 'period-comparison-strategy';
  public name = 'Generic Period Comparison Strategy';

  public compare(
    periodA: PeriodDefinition,
    periodB: PeriodDefinition,
    options?: ComparisonQueryOptions
  ): ComparisonResult {
    const baseStatStrategy = new StatisticalComparisonStrategy();
    const result = baseStatStrategy.compare(periodA, periodB, options);

    const durationA = periodA.endYear - periodA.startYear + 1;
    const durationB = periodB.endYear - periodB.startYear + 1;

    return {
      ...result,
      id: `comparison-period-${periodA.id}-vs-${periodB.id}`,
      title: `Period Comparison: ${periodA.name} (${durationA}Y) vs ${periodB.name} (${durationB}Y)`,
      metadata: {
        ...result.metadata,
        strategyId: this.id,
        durationA,
        durationB,
        durationDifference: Math.abs(durationA - durationB),
      },
    };
  }
}
