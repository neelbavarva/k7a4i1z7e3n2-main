import type { PatternStrategy } from './PatternStrategy';
import type {
  PatternMatch,
  PatternQueryOptions,
  PatternResult,
  MatchingFactor,
  DifferingFactor,
} from '../types/Pattern';
import { DATASET_REGISTRY } from '@/lib/datasets/registry';
import { ComparisonEngine } from '@/lib/comparison';
import { HistoricalContextEngine } from '@/lib/historical';
import { computeWeightedSimilarity, evaluatePatternConfidence } from '../utils/similarity';

export class CompositeSimilarityStrategy implements PatternStrategy {
  public id = 'composite-similarity-strategy';
  public name = 'Composite Multi-Dataset Similarity Strategy';

  public findPatterns(options?: PatternQueryOptions): PatternResult {
    const limit = options?.limit ?? 5;
    const windowSize = options?.windowSizeYears ?? 5;
    const seriesMap = options?.seriesMap ?? {};
    const yearsMap = options?.yearsMap ?? {};

    // Cast or cleanse seriesMap for ComparisonEngine
    const cleanSeriesMap: Record<string, number[]> = {};
    for (const [k, v] of Object.entries(seriesMap)) {
      cleanSeriesMap[k] = (v ?? []).map(val => val ?? 0);
    }

    const availableDatasetIds = options?.targetDatasets?.length
      ? options.targetDatasets
      : Object.keys(DATASET_REGISTRY);

    // Identify current window: latest N years available
    const gdpYears = yearsMap.gdp ?? [2020, 2021, 2022, 2023, 2024];
    const currentEndYear = gdpYears.length ? gdpYears[gdpYears.length - 1] : 2024;
    const currentStartYear = Math.max(gdpYears[0] ?? 1960, currentEndYear - windowSize + 1);

    const currentPeriod = {
      id: `current-${currentStartYear}-${currentEndYear}`,
      name: `Current Environment (${currentStartYear}–${currentEndYear})`,
      startYear: currentStartYear,
      endYear: currentEndYear,
    };

    // Sliding candidate historical windows: steps of 5 years back to 1970
    const matches: PatternMatch[] = [];
    const events = HistoricalContextEngine.getAllEvents();

    for (let endYr = currentStartYear - 1; endYr >= 1970; endYr -= windowSize) {
      const startYr = endYr - windowSize + 1;
      const candidatePeriod = {
        id: `hist-${startYr}-${endYr}`,
        name: `${startYr}–${endYr} Period`,
        startYear: startYr,
        endYear: endYr,
      };

      const comparison = ComparisonEngine.comparePeriods(currentPeriod, candidatePeriod, {
        datasetIds: availableDatasetIds,
        metadata: { seriesMap: cleanSeriesMap, yearsMap },
      });

      if (!comparison || !comparison.datasetComparisons.length) continue;

      const datasetScores: Record<string, number> = {};
      const matchingFactors: MatchingFactor[] = [];
      const differingFactors: DifferingFactor[] = [];

      comparison.datasetComparisons.forEach(dc => {
        datasetScores[dc.datasetId] = dc.similarityScore;
        const meta = DATASET_REGISTRY[dc.datasetId];
        const dsName = meta ? meta.name : dc.datasetId;

        if (dc.similarityScore >= 60) {
          matchingFactors.push({
            datasetId: dc.datasetId,
            datasetName: dsName,
            similarityScore: dc.similarityScore,
            currentMetric: `${dc.periodAStats.mean.toFixed(1)} ${dc.unit}`,
            historicalMetric: `${dc.periodBStats.mean.toFixed(1)} ${dc.unit}`,
            description: `High multi-year alignment in ${dsName} (${dc.similarityScore}% match).`,
          });
        } else {
          differingFactors.push({
            datasetId: dc.datasetId,
            datasetName: dsName,
            divergenceScore: 100 - dc.similarityScore,
            currentMetric: `${dc.periodAStats.mean.toFixed(1)} ${dc.unit}`,
            historicalMetric: `${dc.periodBStats.mean.toFixed(1)} ${dc.unit}`,
            description: `Divergence in ${dsName} (${dc.percentageDifference >= 0 ? '+' : ''}${dc.percentageDifference.toFixed(1)}% difference).`,
          });
        }
      });

      const overallSim = computeWeightedSimilarity(datasetScores, options?.weights ?? {});
      const confidence = evaluatePatternConfidence(comparison.datasetComparisons.length, overallSim, windowSize);

      const matchingEvents = events
        .filter(e => e.startDate <= endYr && (e.endDate === null || e.endDate >= startYr))
        .map(e => e.title);

      const topMatchNames = matchingFactors.map(m => m.datasetName).join(', ');
      const diffMatchNames = differingFactors.map(d => d.datasetName).join(', ');

      const explanation = matchingFactors.length
        ? `The ${startYr}–${endYr} regime aligns closely with today's environment in ${topMatchNames} (${overallSim}% overall composite match)${differingFactors.length ? `, but differs in ${diffMatchNames}` : ''}.`
        : `Moderate baseline structural similarity (${overallSim}%).`;

      matches.push({
        id: candidatePeriod.id,
        rank: 0,
        periodName: candidatePeriod.name,
        startYear: startYr,
        endYear: endYr,
        similarityScore: overallSim,
        confidence,
        explanation,
        matchingFactors,
        differingFactors,
        supportingEvents: matchingEvents,
        metadata: {
          strategyId: this.id,
          zScoreDistance: comparison.datasetComparisons[0]?.zScoreDistance ?? 0,
        },
      });
    }

    // Sort by similarity score desc and assign rank
    matches.sort((a, b) => b.similarityScore - a.similarityScore);
    const topMatches = matches.slice(0, limit).map((m, idx) => ({ ...m, rank: idx + 1 }));

    const overallConfidence = topMatches.length ? topMatches[0].confidence : 'low';
    const topPeriod = topMatches.length ? topMatches[0].periodName : 'N/A';

    return {
      id: `pattern-composite-${currentStartYear}-${currentEndYear}`,
      title: `Composite Macro Regime Pattern Search`,
      strategyId: this.id,
      currentRegimeSummary: `Analyzing multi-dataset regime similarity for current environment (${currentStartYear}–${currentEndYear}) across ${availableDatasetIds.length} datasets.`,
      topMatches,
      confidence: overallConfidence,
      explanation: topMatches.length
        ? `The macroeconomic environment most similar to today is ${topPeriod} (${topMatches[0].similarityScore}% composite match).`
        : `Insufficient historical data overlap to establish composite regime matches.`,
      metadata: {
        strategyId: this.id,
        candidateWindowsEvaluated: matches.length,
      },
    };
  }
}
