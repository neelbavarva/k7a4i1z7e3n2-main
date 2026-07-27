import type { Insight, InsightQueryOptions } from '../types/Insight';
import { InsightRegistry } from '../registry/registry';

export class InsightEngine {
  private static cache = new Map<string, Insight[]>();
  /** Secondary cache: id → Insight for O(1) single-insight lookups. */
  private static idCache = new Map<string, Insight>();

  public static clearCache(): void {
    this.cache.clear();
    this.idCache.clear();
  }

  public static buildInsight(data: Partial<Insight>): Insight {
    return {
      id: data.id ?? `insight-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: data.title ?? 'Macroeconomic Insight',
      summary: data.summary ?? '',
      significance: data.significance ?? '',
      confidence: data.confidence ?? 'medium',
      importance: data.importance ?? 3,
      relatedEvents: data.relatedEvents ?? [],
      affectedDatasets: data.affectedDatasets ?? ['*'],
      tags: data.tags ?? [],
      references: data.references ?? [],
      metadata: data.metadata ?? {},
    };
  }

  public static buildInsights(dataList: Partial<Insight>[]): Insight[] {
    return dataList.map(data => this.buildInsight(data));
  }

  /**
   * Fetch a single insight by ID.
   * Uses a dedicated id→Insight cache; only populates the full catalogue once.
   */
  public static getInsight(id: string): Insight | null {
    if (this.idCache.has(id)) {
      return this.idCache.get(id)!;
    }

    // Warm the id cache from the full result set (cached separately)
    const all = this.queryInsights();
    all.forEach(insight => this.idCache.set(insight.id, insight));

    return this.idCache.get(id) ?? null;
  }

  public static getInsightsForDataset(datasetId: string): Insight[] {
    const cacheKey = `dataset:${datasetId}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const results = InsightRegistry.queryAllProviders({ datasetId });
    this.cache.set(cacheKey, results);
    return results;
  }

  public static getInsightsForEvent(eventId: string): Insight[] {
    const cacheKey = `event:${eventId}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const results = InsightRegistry.queryAllProviders({ eventId });
    this.cache.set(cacheKey, results);
    return results;
  }

  public static getRelatedInsights(insightId: string): Insight[] {
    const cacheKey = `related:${insightId}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const target = this.getInsight(insightId);
    if (!target) return [];

    const all = this.queryInsights();
    const results = all.filter(candidate => {
      if (candidate.id === insightId) return false;
      const hasEventOverlap = candidate.relatedEvents.some(e => target.relatedEvents.includes(e));
      const hasDatasetOverlap = candidate.affectedDatasets.some(d => target.affectedDatasets.includes(d) || d === '*');
      const hasTagOverlap = candidate.tags.some(t => target.tags.includes(t));
      return hasEventOverlap || hasDatasetOverlap || hasTagOverlap;
    });

    this.cache.set(cacheKey, results);
    return results;
  }

  public static queryInsights(query?: InsightQueryOptions): Insight[] {
    const cacheKey = JSON.stringify(query ?? {});
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const results = InsightRegistry.queryAllProviders(query);
    this.cache.set(cacheKey, results);
    return results;
  }
}
