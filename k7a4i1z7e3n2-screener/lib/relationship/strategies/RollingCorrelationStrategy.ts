import type { RelationshipStrategy } from './RelationshipStrategy';
import type {
  DatasetPair,
  RelationshipQueryOptions,
  RelationshipResult,
  RollingCorrelationPoint,
} from '../types/Relationship';
import {
  alignTimeSeries,
  calculatePearsonCorrelation,
  classifyStrength,
  classifyDirection,
  calculateConfidence,
} from '../utils/alignment';

export class RollingCorrelationStrategy implements RelationshipStrategy {
  public id = 'rolling-correlation-strategy';
  public name = 'Rolling Window Correlation Strategy';

  public compute(pair: DatasetPair, options: RelationshipQueryOptions): RelationshipResult {
    const windowSize = options.windowSize ?? 10;
    const aligned = alignTimeSeries(
      options.seriesA,
      options.yearsA,
      options.seriesB,
      options.yearsB,
      options.timeRange
    );

    const labelA = pair.labelA ?? pair.datasetIdA;
    const labelB = pair.labelB ?? pair.datasetIdB;

    if (aligned.length < windowSize) {
      return {
        id: `rel-rolling-${pair.datasetIdA}-vs-${pair.datasetIdB}`,
        pair,
        strategyId: this.id,
        relationshipType: 'rolling_correlation',
        correlation: null,
        strength: 'negligible',
        direction: 'none',
        confidence: 'low',
        sampleSize: aligned.length,
        timeRange: null,
        summary: `Insufficient observations (${aligned.length}) for a ${windowSize}-year rolling window correlation between ${labelA} and ${labelB}.`,
        metadata: {
          strategyId: this.id,
          windowSize,
          rollingPoints: [],
        },
      };
    }

    const rollingPoints: RollingCorrelationPoint[] = [];
    for (let i = 0; i < aligned.length; i++) {
      const windowStartIdx = Math.max(0, i - windowSize + 1);
      const windowSlice = aligned.slice(windowStartIdx, i + 1);
      const year = aligned[i].year;

      if (windowSlice.length < 3) {
        rollingPoints.push({ year, correlation: null, sampleSize: windowSlice.length });
      } else {
        const windowR = calculatePearsonCorrelation(windowSlice);
        rollingPoints.push({
          year,
          correlation: windowR !== null ? Number(windowR.toFixed(4)) : null,
          sampleSize: windowSlice.length,
        });
      }
    }

    // Overall correlation for full aligned series
    const overallR = calculatePearsonCorrelation(aligned);
    const strength = classifyStrength(overallR);
    const direction = classifyDirection(overallR);
    const confidence = calculateConfidence(aligned.length, overallR);

    // Latest window correlation for summary context
    const validRolling = rollingPoints.filter(p => p.correlation !== null);
    const latestRolling = validRolling.length ? validRolling[validRolling.length - 1].correlation : null;

    const startYear = aligned[0].year;
    const endYear = aligned[aligned.length - 1].year;
    const timeRange = { startYear, endYear };

    const overallFmt = overallR !== null ? (overallR >= 0 ? `+${overallR.toFixed(2)}` : overallR.toFixed(2)) : 'N/A';
    const latestFmt = latestRolling !== null ? (latestRolling >= 0 ? `+${latestRolling.toFixed(2)}` : latestRolling.toFixed(2)) : 'N/A';

    const summary = `${windowSize}-year rolling correlation between ${labelA} and ${labelB} ranges from historical r = ${overallFmt} overall to r = ${latestFmt} in the most recent ${windowSize}-year window.`;

    return {
      id: `rel-rolling-${pair.datasetIdA}-vs-${pair.datasetIdB}`,
      pair,
      strategyId: this.id,
      relationshipType: 'rolling_correlation',
      correlation: overallR !== null ? Number(overallR.toFixed(4)) : null,
      strength,
      direction,
      confidence,
      sampleSize: aligned.length,
      timeRange,
      summary,
      metadata: {
        strategyId: this.id,
        windowSize,
        latestRollingCorrelation: latestRolling,
        rollingPoints,
      },
    };
  }
}
