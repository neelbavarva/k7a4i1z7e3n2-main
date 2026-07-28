// Types
export type {
  ScenarioAdjustmentType,
  ScenarioConfidence,
  ScenarioInput,
  ScenarioHorizon,
  ProjectedPoint,
  HistoricalAnalogueEvidence,
  ScenarioRelationshipEvidence,
  ScenarioResult,
  ScenarioQueryOptions,
} from './types/Scenario';

// Strategies & Registry
export type { ScenarioStrategy } from './strategies/ScenarioStrategy';
export { TrendProjectionStrategy } from './strategies/TrendProjectionStrategy';
export { RelationshipProjectionStrategy } from './strategies/RelationshipProjectionStrategy';
export { HistoricalProjectionStrategy } from './strategies/HistoricalProjectionStrategy';
export { ScenarioRegistry } from './registry/registry';

// Engine & Utils
export { ScenarioEngine } from './engine/ScenarioEngine';
export {
  calculateTargetValue,
  generateTrajectory,
  evaluateConfidence,
} from './utils/projection';
