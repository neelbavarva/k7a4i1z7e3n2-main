import type { InsightProvider } from './InsightProvider';
import type { Insight, InsightQueryOptions } from '../types/Insight';
import { HistoricalContextEngine } from '@/lib/historical';
import { DATASET_REGISTRY } from '@/lib/datasets/registry';
import { mean, standardDeviation, zScore } from '@/lib/analysis/statistics';

/**
 * Defines a comparable historical period window keyed to a HistoricalEvent ID.
 * The engine computes similarity by comparing z-scores of dataset values
 * during that window against the current reading.
 */
interface PeriodWindow {
  eventId: string;
  startYear: number;
  endYear: number;
}

export class HistoricalComparisonProvider implements InsightProvider {
  public id = 'historical-comparison-provider';
  public name = 'Historical Period Comparison Provider';

  public generateInsights(query?: InsightQueryOptions): Insight[] {
    const seriesMap = (query?.metadata?.seriesMap ?? {}) as Record<string, number[]>;
    const yearsMap = (query?.metadata?.yearsMap ?? {}) as Record<string, number[]>;
    const datasetIds = query?.datasetId
      ? [query.datasetId]
      : Object.keys(DATASET_REGISTRY);

    const insights: Insight[] = [];
    const events = HistoricalContextEngine.getAllEvents();

    // Build period windows from high-importance historical events (≥ 4)
    const periodWindows: PeriodWindow[] = events
      .filter(e => e.importance >= 4 && typeof e.endDate === 'number')
      .map(e => ({
        eventId: e.id,
        startYear: e.startDate,
        endYear: e.endDate as number,
      }));

    if (!periodWindows.length) return insights;

    datasetIds.forEach(datasetId => {
      const meta = DATASET_REGISTRY[datasetId];
      if (!meta) return;

      const historicalValues = seriesMap[datasetId];
      const historicalYears = yearsMap[datasetId];
      if (!historicalValues || !historicalYears || historicalValues.length < 5) return;

      const currentValue = historicalValues[historicalValues.length - 1];
      const seriesMean = mean(historicalValues);
      const seriesSd = standardDeviation(historicalValues);
      const currentZ = zScore(currentValue, seriesMean, seriesSd);

      // Score each historical period by z-score proximity to current reading
      const scored = periodWindows
        .map(window => {
          const periodIndices = historicalYears
            .map((yr, idx) => ({ yr, idx }))
            .filter(({ yr }) => yr >= window.startYear && yr <= window.endYear)
            .map(({ idx }) => idx);

          if (!periodIndices.length) return null;

          const periodValues = periodIndices
            .map(i => historicalValues[i])
            .filter(v => typeof v === 'number' && Number.isFinite(v)) as number[];

          if (!periodValues.length) return null;

          const periodMean = mean(periodValues);
          const periodZ = zScore(periodMean, seriesMean, seriesSd);
          const similarity = 1 - Math.min(1, Math.abs(currentZ - periodZ) / 3);
          const event = events.find(e => e.id === window.eventId);

          return { window, similarity, periodMean, event };
        })
        .filter(Boolean)
        .sort((a, b) => b!.similarity - a!.similarity);

      const best = scored[0];
      if (!best || best.similarity < 0.5 || !best.event) return;

      const simPct = Math.round(best.similarity * 100);
      const confidenceLevel: 'high' | 'medium' | 'low' =
        simPct >= 80 ? 'high' : simPct >= 65 ? 'medium' : 'low';

      insights.push({
        id: `insight-comparison-${datasetId}`,
        title: `${meta.shortName} Most Resembles ${best.event.title} Period`,
        summary: `Current ${meta.name} (${currentValue.toFixed(2)} ${meta.unit}) is most similar to the ${best.event.title} period (${best.window.startYear}–${best.window.endYear}), with a ${simPct}% structural similarity based on z-score proximity.`,
        significance: `When ${meta.name} exhibited similar readings during ${best.event.title}, it was associated with ${best.event.description}. This historical parallel provides context for current conditions.`,
        confidence: confidenceLevel,
        importance: Math.min(5, Math.max(2, best.event.importance)) as 1 | 2 | 3 | 4 | 5,
        relatedEvents: [best.event.id],
        affectedDatasets: [datasetId],
        tags: ['comparison', 'historical-parallel', best.event.category, meta.compatibilityGroup],
        references: best.event.references ?? [],
        metadata: {
          similarity: simPct,
          currentZScore: currentZ,
          periodMean: best.periodMean,
          matchedEventId: best.event.id,
          matchedPeriod: `${best.window.startYear}–${best.window.endYear}`,
          providerId: this.id,
        },
      });
    });

    return insights;
  }
}
