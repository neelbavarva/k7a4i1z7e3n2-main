// Types
export type {
  PatternMatchConfidence,
  DatasetWeightMap,
  MatchingFactor,
  DifferingFactor,
  PatternMatch,
  PatternResult,
  PatternQueryOptions,
} from './types/Pattern';

// Strategies & Registry
export type { PatternStrategy } from './strategies/PatternStrategy';
export { CompositeSimilarityStrategy } from './strategies/CompositeSimilarityStrategy';
export { WeightedSimilarityStrategy } from './strategies/WeightedSimilarityStrategy';
export { HistoricalPatternStrategy } from './strategies/HistoricalPatternStrategy';
export { PatternRegistry } from './registry/registry';

// Engine & Utils
export { PatternEngine } from './engine/PatternEngine';
export {
  distanceToSimilarityScore,
  computeWeightedSimilarity,
  evaluatePatternConfidence,
} from './utils/similarity';
