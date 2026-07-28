import type { RelationshipStrategy } from './RelationshipStrategy';
import type { DatasetPair, RelationshipQueryOptions, RelationshipResult } from '../types/Relationship';
import {
  alignTimeSeries,
  calculatePearsonCorrelation,
  classifyStrength,
  classifyDirection,
  calculateConfidence,
} from '../utils/alignment';

export class CorrelationStrategy implements RelationshipStrategy {
  public id = 'correlation-strategy';
  public name = 'Linear Correlation Strategy';

  public compute(pair: DatasetPair, options: RelationshipQueryOptions): RelationshipResult {
    const aligned = alignTimeSeries(
      options.seriesA,
      options.yearsA,
      options.seriesB,
      options.yearsB,
      options.timeRange
    );

    const labelA = pair.labelA ?? pair.datasetIdA;
    const labelB = pair.labelB ?? pair.datasetIdB;

    if (aligned.length < 3) {
      return {
        id: `rel-corr-${pair.datasetIdA}-vs-${pair.datasetIdB}`,
        pair,
        strategyId: this.id,
        relationshipType: 'linear_correlation',
        correlation: null,
        strength: 'negligible',
        direction: 'none',
        confidence: 'low',
        sampleSize: aligned.length,
        timeRange: null,
        summary: `Insufficient aligned historical observations between ${labelA} and ${labelB} to compute linear correlation (requires at least 3 points).`,
        metadata: {
          strategyId: this.id,
          alignedPointsCount: aligned.length,
        },
      };
    }

    const r = calculatePearsonCorrelation(aligned);
    const strength = classifyStrength(r);
    const direction = classifyDirection(r);
    const confidence = calculateConfidence(aligned.length, r);

    const startYear = aligned[0].year;
    const endYear = aligned[aligned.length - 1].year;
    const timeRange = { startYear, endYear };

    const rFormatted = r !== null ? (r >= 0 ? `+${r.toFixed(2)}` : r.toFixed(2)) : 'N/A';
    const summary = `${labelA} and ${labelB} exhibit a ${strength} ${direction} linear correlation (r = ${rFormatted}) across ${aligned.length} annual observations (${startYear}–${endYear}).`;

    return {
      id: `rel-corr-${pair.datasetIdA}-vs-${pair.datasetIdB}`,
      pair,
      strategyId: this.id,
      relationshipType: 'linear_correlation',
      correlation: r !== null ? Number(r.toFixed(4)) : null,
      strength,
      direction,
      confidence,
      sampleSize: aligned.length,
      timeRange,
      summary,
      metadata: {
        strategyId: this.id,
        alignedPointsCount: aligned.length,
        rSquared: r !== null ? Number((r * r).toFixed(4)) : null,
      },
    };
  }
}
