// Types
export type {
  PeriodDefinition,
  PeriodStats,
  DatasetComparison,
  ComparisonReference,
  ComparisonResult,
  ComparisonQueryOptions,
} from './types/Comparison';

// Strategies & Registry
export type { ComparisonStrategy } from './strategies/ComparisonStrategy';
export { StatisticalComparisonStrategy } from './strategies/StatisticalComparisonStrategy';
export { HistoricalEventComparisonStrategy } from './strategies/HistoricalEventComparisonStrategy';
export { PeriodComparisonStrategy } from './strategies/PeriodComparisonStrategy';
export { ComparisonRegistry } from './registry/registry';

// Engine
export { ComparisonEngine } from './engine/ComparisonEngine';
