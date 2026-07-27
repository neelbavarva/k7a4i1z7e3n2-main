import type { InsightProvider } from './InsightProvider';
import type { Insight, InsightQueryOptions } from '../types/Insight';
import { DATASET_REGISTRY } from '@/lib/datasets/registry';

export class StatisticalInsightProvider implements InsightProvider {
  public id = 'statistical-provider';
  public name = 'Statistical Regime Anomaly Provider';

  public generateInsights(query?: InsightQueryOptions): Insight[] {
    const datasetIds = query?.datasetId ? [query.datasetId] : Object.keys(DATASET_REGISTRY);
    const insights: Insight[] = [];

    datasetIds.forEach(id => {
      const meta = DATASET_REGISTRY[id];
      if (!meta) return;

      insights.push({
        id: `insight-stat-${id}`,
        title: `${meta.name} Long-Term Statistical Framework`,
        summary: `Statistical analysis of ${meta.name} utilizes the ${meta.analysisModel ?? 'trend'} model across historical observations.`,
        significance: `Enables deviation quantification and percentile ranking for ${meta.shortName} relative to long-term baseline trends.`,
        confidence: 'high',
        importance: 4,
        relatedEvents: [],
        affectedDatasets: [id],
        tags: ['statistics', 'regime', meta.compatibilityGroup],
        references: [],
        metadata: {
          analysisModel: meta.analysisModel,
          unit: meta.unit,
          providerId: this.id,
        },
      });
    });

    return insights;
  }
}
