import type { PeriodDefinition, ComparisonResult, ComparisonQueryOptions } from '../types/Comparison';

export interface ComparisonStrategy {
  id: string;
  name: string;
  compare(
    periodA: PeriodDefinition,
    periodB: PeriodDefinition,
    options?: ComparisonQueryOptions
  ): ComparisonResult;
}
