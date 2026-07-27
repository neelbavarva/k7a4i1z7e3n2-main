import type { InsightProvider } from './InsightProvider';
import type { Insight, InsightQueryOptions } from '../types/Insight';
import { DATASET_REGISTRY } from '@/lib/datasets/registry';

/**
 * Configurable threshold definition per dataset.
 * All values are expressed in the dataset's native unit.
 */
interface ThresholdConfig {
  historicalHigh?: number;
  historicalLow?: number;
  dangerZoneHigh?: number;
  dangerZoneLow?: number;
  overheatedAbove?: number;
  undervaluedBelow?: number;
}

/**
 * Threshold definitions keyed by dataset ID.
 * These are configurable and independent from the engine.
 * Driven by dataset metadata units and known macroeconomic conventions.
 */
const THRESHOLD_CONFIG: Record<string, ThresholdConfig> = {
  buffett: {
    historicalHigh: 200,
    historicalLow: 40,
    overheatedAbove: 160,
    undervaluedBelow: 60,
    dangerZoneHigh: 180,
  },
  gdpGrowth: {
    historicalHigh: 7,
    historicalLow: -4,
    dangerZoneHigh: 6,
    dangerZoneLow: -3,
  },
};

export class ThresholdProvider implements InsightProvider {
  public id = 'threshold-provider';
  public name = 'Threshold Crossing Detector';

  public generateInsights(query?: InsightQueryOptions): Insight[] {
    const seriesMap = (query?.metadata?.seriesMap ?? {}) as Record<string, number[]>;
    const datasetIds = query?.datasetId
      ? [query.datasetId]
      : Object.keys(THRESHOLD_CONFIG);

    const insights: Insight[] = [];

    datasetIds.forEach(id => {
      const config = THRESHOLD_CONFIG[id];
      const meta = DATASET_REGISTRY[id];
      if (!config || !meta) return;

      const historicalValues = seriesMap[id];
      if (!historicalValues || historicalValues.length < 2) return;

      const latestValue = historicalValues[historicalValues.length - 1];
      const conditions: Array<{ label: string; severity: 'high' | 'medium' | 'low'; importance: 1 | 2 | 3 | 4 | 5 }> = [];

      if (config.dangerZoneHigh !== undefined && latestValue >= config.dangerZoneHigh) {
        conditions.push({ label: 'danger zone (extreme high)', severity: 'high', importance: 5 });
      } else if (config.overheatedAbove !== undefined && latestValue >= config.overheatedAbove) {
        conditions.push({ label: 'overheated territory', severity: 'high', importance: 4 });
      } else if (config.historicalHigh !== undefined && latestValue >= config.historicalHigh) {
        conditions.push({ label: 'historical high region', severity: 'medium', importance: 3 });
      }

      if (config.dangerZoneLow !== undefined && latestValue <= config.dangerZoneLow) {
        conditions.push({ label: 'danger zone (extreme low)', severity: 'high', importance: 5 });
      } else if (config.undervaluedBelow !== undefined && latestValue <= config.undervaluedBelow) {
        conditions.push({ label: 'undervalued territory', severity: 'medium', importance: 3 });
      } else if (config.historicalLow !== undefined && latestValue <= config.historicalLow) {
        conditions.push({ label: 'historical low region', severity: 'medium', importance: 3 });
      }

      if (!conditions.length) return;

      const topCondition = conditions[0];

      insights.push({
        id: `insight-threshold-${id}`,
        title: `${meta.shortName} Enters ${topCondition.label.replace(/\b\w/g, c => c.toUpperCase())}`,
        summary: `${meta.name} is currently at ${latestValue.toFixed(2)} ${meta.unit}, placing it in ${topCondition.label}. Configured reference levels: high ${config.historicalHigh ?? 'N/A'}, low ${config.historicalLow ?? 'N/A'}.`,
        significance: `Threshold crossings in ${meta.name} historically precede major market or economic regime shifts. Current positioning warrants elevated attention from analysts and risk managers.`,
        confidence: topCondition.severity,
        importance: topCondition.importance,
        relatedEvents: [],
        affectedDatasets: [id],
        tags: ['threshold', topCondition.label.split(' ')[0], meta.compatibilityGroup],
        references: [],
        metadata: {
          latestValue,
          conditions,
          config,
          providerId: this.id,
        },
      });
    });

    return insights;
  }
}
