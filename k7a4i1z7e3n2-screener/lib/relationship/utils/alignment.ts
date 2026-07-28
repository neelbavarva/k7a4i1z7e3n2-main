import { mean, standardDeviation } from '@/lib/analysis/statistics';
import type {
  RelationshipDirection,
  RelationshipStrength,
  RelationshipConfidence,
  RelationshipTimeRange,
} from '../types/Relationship';

export interface AlignedDataPoint {
  year: number;
  valA: number;
  valB: number;
}

/**
 * Aligns two time-series datasets by year intersection and filters out nulls/NaNs.
 */
export function alignTimeSeries(
  seriesA?: (number | null)[],
  yearsA?: number[],
  seriesB?: (number | null)[],
  yearsB?: number[],
  timeRange?: RelationshipTimeRange
): AlignedDataPoint[] {
  if (!seriesA || !yearsA || !seriesB || !yearsB) return [];

  const mapA = new Map<number, number>();
  yearsA.forEach((yr, idx) => {
    const val = seriesA[idx];
    if (val !== null && val !== undefined && Number.isFinite(val)) {
      if (!timeRange || (yr >= timeRange.startYear && yr <= timeRange.endYear)) {
        mapA.set(yr, val);
      }
    }
  });

  const aligned: AlignedDataPoint[] = [];
  yearsB.forEach((yr, idx) => {
    const valB = seriesB[idx];
    if (valB !== null && valB !== undefined && Number.isFinite(valB)) {
      if (!timeRange || (yr >= timeRange.startYear && yr <= timeRange.endYear)) {
        const valA = mapA.get(yr);
        if (valA !== undefined) {
          aligned.push({ year: yr, valA, valB });
        }
      }
    }
  });

  return aligned.sort((a, b) => a.year - b.year);
}

/**
 * Calculates Pearson correlation coefficient (r) for aligned pairs.
 */
export function calculatePearsonCorrelation(points: AlignedDataPoint[]): number | null {
  if (points.length < 3) return null;

  const valsA = points.map(p => p.valA);
  const valsB = points.map(p => p.valB);

  const meanA = mean(valsA);
  const meanB = mean(valsB);
  const sdA = standardDeviation(valsA);
  const sdB = standardDeviation(valsB);

  if (sdA === 0 || sdB === 0) return 0;

  let sumCrossDev = 0;
  for (let i = 0; i < points.length; i++) {
    sumCrossDev += (valsA[i] - meanA) * (valsB[i] - meanB);
  }

  const r = sumCrossDev / (points.length * sdA * sdB);
  return Number.isFinite(r) ? Math.max(-1, Math.min(1, r)) : null;
}

export function classifyStrength(r: number | null): RelationshipStrength {
  if (r === null) return 'negligible';
  const absR = Math.abs(r);
  if (absR >= 0.7) return 'strong';
  if (absR >= 0.4) return 'moderate';
  if (absR >= 0.2) return 'weak';
  return 'negligible';
}

export function classifyDirection(r: number | null): RelationshipDirection {
  if (r === null) return 'none';
  if (r > 0.1) return 'positive';
  if (r < -0.1) return 'negative';
  return 'none';
}

export function calculateConfidence(sampleSize: number, r: number | null): RelationshipConfidence {
  if (sampleSize < 5 || r === null) return 'low';
  const absR = Math.abs(r);
  if (sampleSize >= 20 && absR >= 0.5) return 'high';
  if (sampleSize >= 10 || absR >= 0.6) return 'medium';
  return 'low';
}
