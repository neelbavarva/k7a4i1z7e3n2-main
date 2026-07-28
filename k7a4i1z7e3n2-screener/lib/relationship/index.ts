// Types
export type {
  RelationshipStrength,
  RelationshipDirection,
  RelationshipConfidence,
  RelationshipTimeRange,
  DatasetPair,
  RollingCorrelationPoint,
  LeadLagResult,
  RelationshipResult,
  RelationshipQueryOptions,
} from './types/Relationship';

// Strategies & Registry
export type { RelationshipStrategy } from './strategies/RelationshipStrategy';
export { CorrelationStrategy } from './strategies/CorrelationStrategy';
export { RollingCorrelationStrategy } from './strategies/RollingCorrelationStrategy';
export { LeadLagStrategy } from './strategies/LeadLagStrategy';
export { RelationshipRegistry } from './registry/registry';

// Engine & Utils
export { RelationshipEngine } from './engine/RelationshipEngine';
export {
  alignTimeSeries,
  calculatePearsonCorrelation,
  classifyStrength,
  classifyDirection,
  calculateConfidence,
} from './utils/alignment';
