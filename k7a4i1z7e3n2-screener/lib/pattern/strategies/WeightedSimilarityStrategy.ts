import type { PatternStrategy } from './PatternStrategy';
import type { PatternQueryOptions, PatternResult } from '../types/Pattern';
import { CompositeSimilarityStrategy } from './CompositeSimilarityStrategy';

export class WeightedSimilarityStrategy implements PatternStrategy {
  public id = 'weighted-similarity-strategy';
  public name = 'User-Weighted Macro Pattern Strategy';

  public findPatterns(options?: PatternQueryOptions): PatternResult {
    const baseStrategy = new CompositeSimilarityStrategy();
    const baseResult = baseStrategy.findPatterns(options);

    const weights = options?.weights ?? {};
    const weightedDatasets = Object.keys(weights).filter(k => (weights[k] ?? 1.0) > 1.0);

    const weightNote = weightedDatasets.length
      ? `Weighted priorities applied to: ${weightedDatasets.join(', ')}.`
      : `Default equal weights applied across all active datasets.`;

    return {
      ...baseResult,
      id: `pattern-weighted-${Date.now()}`,
      title: `Weighted Macro Pattern Search`,
      strategyId: this.id,
      explanation: `${baseResult.explanation} ${weightNote}`,
      metadata: {
        ...baseResult.metadata,
        strategyId: this.id,
        weightsApplied: weights,
      },
    };
  }
}
