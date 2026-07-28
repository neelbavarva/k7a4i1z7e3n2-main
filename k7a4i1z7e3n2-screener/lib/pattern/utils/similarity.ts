import type { DatasetWeightMap, PatternMatchConfidence } from '../types/Pattern';

/**
 * Converts a Euclidean / Z-score distance to a 0–100 similarity score.
 */
export function distanceToSimilarityScore(zScoreDistance: number): number {
  if (!Number.isFinite(zScoreDistance) || zScoreDistance < 0) return 50;
  // Exp decay: distance 0 -> 100%, distance 1.0 -> 75%, distance 2.0 -> 50%, distance 4.0 -> 25%
  const score = 100 * Math.exp(-0.35 * zScoreDistance);
  return Math.round(Math.min(100, Math.max(0, score)));
}

/**
 * Computes a weighted average score from individual dataset similarity scores.
 */
export function computeWeightedSimilarity(
  datasetScores: Record<string, number>,
  weights: DatasetWeightMap
): number {
  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const [dsId, score] of Object.entries(datasetScores)) {
    const w = weights[dsId] ?? 1.0;
    if (w > 0 && Number.isFinite(score)) {
      totalWeightedScore += score * w;
      totalWeight += w;
    }
  }

  if (totalWeight === 0) return 50;
  return Math.round(totalWeightedScore / totalWeight);
}

/**
 * Evaluates match confidence based on datasets compared, sample depth, and average similarity.
 */
export function evaluatePatternConfidence(
  comparedDatasetCount: number,
  avgSimilarity: number,
  sampleYears: number
): PatternMatchConfidence {
  if (comparedDatasetCount < 2 || sampleYears < 3) return 'low';
  if (comparedDatasetCount >= 3 && avgSimilarity >= 70 && sampleYears >= 5) return 'high';
  if (comparedDatasetCount >= 2 && avgSimilarity >= 50) return 'medium';
  return 'low';
}
