import type { RelationshipStrategy } from './RelationshipStrategy';
import type {
  DatasetPair,
  LeadLagResult,
  RelationshipQueryOptions,
  RelationshipResult,
} from '../types/Relationship';
import {
  alignTimeSeries,
  calculatePearsonCorrelation,
  classifyStrength,
  classifyDirection,
  calculateConfidence,
} from '../utils/alignment';

export class LeadLagStrategy implements RelationshipStrategy {
  public id = 'lead-lag-strategy';
  public name = 'Lead/Lag Relationship Strategy';

  public compute(pair: DatasetPair, options: RelationshipQueryOptions): RelationshipResult {
    const maxLag = options.maxLag ?? 5;
    const seriesA = options.seriesA;
    const yearsA = options.yearsA;
    const seriesB = options.seriesB;
    const yearsB = options.yearsB;

    const labelA = pair.labelA ?? pair.datasetIdA;
    const labelB = pair.labelB ?? pair.datasetIdB;

    if (!seriesA || !yearsA || !seriesB || !yearsB || seriesA.length < 5 || seriesB.length < 5) {
      return {
        id: `rel-leadlag-${pair.datasetIdA}-vs-${pair.datasetIdB}`,
        pair,
        strategyId: this.id,
        relationshipType: 'lead_lag',
        correlation: null,
        strength: 'negligible',
        direction: 'none',
        confidence: 'low',
        sampleSize: 0,
        timeRange: null,
        summary: `Insufficient data to run lead/lag analysis between ${labelA} and ${labelB}.`,
        metadata: {
          strategyId: this.id,
          maxLag,
          leadLagResult: null,
        },
      };
    }

    const lagScan: { lag: number; correlation: number; sampleSize: number }[] = [];

    // Test lags from -maxLag to +maxLag
    // lag > 0: shift yearsA by +lag (A value at year t is compared against B value at year t + lag, meaning A leads B by `lag` years)
    for (let lag = -maxLag; lag <= maxLag; lag++) {
      const shiftedYearsA = yearsA.map(yr => yr + lag);
      const aligned = alignTimeSeries(seriesA, shiftedYearsA, seriesB, yearsB, options.timeRange);

      if (aligned.length >= 3) {
        const r = calculatePearsonCorrelation(aligned);
        if (r !== null) {
          lagScan.push({
            lag,
            correlation: Number(r.toFixed(4)),
            sampleSize: aligned.length,
          });
        }
      }
    }

    if (!lagScan.length) {
      return {
        id: `rel-leadlag-${pair.datasetIdA}-vs-${pair.datasetIdB}`,
        pair,
        strategyId: this.id,
        relationshipType: 'lead_lag',
        correlation: null,
        strength: 'negligible',
        direction: 'none',
        confidence: 'low',
        sampleSize: 0,
        timeRange: null,
        summary: `No sufficient overlapping periods found across lag range [-${maxLag}, +${maxLag}] between ${labelA} and ${labelB}.`,
        metadata: {
          strategyId: this.id,
          maxLag,
          lagScan: [],
        },
      };
    }

    // Find optimal lag by max absolute correlation
    const optimal = lagScan.reduce((best, curr) =>
      Math.abs(curr.correlation) > Math.abs(best.correlation) ? curr : best
    );

    let interpretation = '';
    if (optimal.lag === 0) {
      interpretation = `${labelA} and ${labelB} move synchronously (coincident, 0-year lag) with r = ${optimal.correlation.toFixed(2)}.`;
    } else if (optimal.lag > 0) {
      interpretation = `${labelA} leads ${labelB} by ${optimal.lag} year${optimal.lag > 1 ? 's' : ''} (r = ${optimal.correlation.toFixed(2)}).`;
    } else {
      const absLag = Math.abs(optimal.lag);
      interpretation = `${labelB} leads ${labelA} by ${absLag} year${absLag > 1 ? 's' : ''} (r = ${optimal.correlation.toFixed(2)}).`;
    }

    const zeroLagScan = lagScan.find(s => s.lag === 0);
    const zeroLagCorrelation = zeroLagScan ? zeroLagScan.correlation : null;

    const strength = classifyStrength(optimal.correlation);
    const direction = classifyDirection(optimal.correlation);
    const confidence = calculateConfidence(optimal.sampleSize, optimal.correlation);

    const leadLagResult: LeadLagResult = {
      optimalLag: optimal.lag,
      laggedCorrelation: optimal.correlation,
      interpretation,
      lagScan,
    };

    return {
      id: `rel-leadlag-${pair.datasetIdA}-vs-${pair.datasetIdB}`,
      pair,
      strategyId: this.id,
      relationshipType: 'lead_lag',
      correlation: zeroLagCorrelation,
      strength,
      direction,
      confidence,
      sampleSize: optimal.sampleSize,
      timeRange: options.timeRange ?? null,
      summary: interpretation,
      metadata: {
        strategyId: this.id,
        maxLag,
        optimalLag: optimal.lag,
        optimalCorrelation: optimal.correlation,
        leadLagResult,
      },
    };
  }
}
