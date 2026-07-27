import type { InsightProvider } from './InsightProvider';
import type { Insight, InsightQueryOptions } from '../types/Insight';
import { HistoricalContextEngine } from '@/lib/historical';
import { DATASET_REGISTRY } from '@/lib/datasets/registry';

export class RuleBasedInsightProvider implements InsightProvider {
  public id = 'rule-based-provider';
  public name = 'Rule-Based Historical Correlation Provider';

  public generateInsights(query?: InsightQueryOptions): Insight[] {
    const events = HistoricalContextEngine.getAllEvents();
    const insights: Insight[] = [];

    events.forEach(event => {
      // Apply query filters if provided
      if (query?.datasetId && event.affectedDatasets && !event.affectedDatasets.includes('*') && !event.affectedDatasets.includes(query.datasetId)) {
        return;
      }
      if (query?.eventId && event.id !== query.eventId) {
        return;
      }
      if (query?.minImportance && event.importance < query.minImportance) {
        return;
      }

      // Generate structured historical correlation insight
      const primaryDatasetKey = event.affectedDatasets?.find(d => d !== '*') ?? 'gdp';
      const datasetMeta = DATASET_REGISTRY[primaryDatasetKey];

      insights.push({
        id: `insight-rule-${event.id}`,
        title: `${event.title}: Macroeconomic Structure & Significance`,
        summary: event.description,
        significance: `Historical event '${event.title}' directly impacted ${datasetMeta?.name ?? 'macroeconomic indicators'} across the ${event.startDate}${event.endDate ? `–${event.endDate}` : ''} window.`,
        confidence: 'high',
        importance: event.importance,
        relatedEvents: [event.id],
        affectedDatasets: event.affectedDatasets ?? ['*'],
        tags: event.tags ?? [],
        references: event.references,
        metadata: {
          category: event.category,
          peakYear: event.peakDate,
          providerId: this.id,
        },
      });
    });

    return insights;
  }
}
