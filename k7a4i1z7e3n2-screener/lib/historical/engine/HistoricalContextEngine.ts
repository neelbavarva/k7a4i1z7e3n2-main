import type { HistoricalEvent, HistoricalFilterOptions } from '../types/HistoricalEvent';
import type { HistoricalEventCategory } from '../types/HistoricalEventCategory';
import { HistoricalEventRegistry } from '../registry/registry';
import { EventIndex } from './EventIndex';
import { EventFilter } from './EventFilter';
import { EventDensity } from './EventDensity';

export class HistoricalContextEngine {
  private static index: EventIndex | null = null;
  private static cache = new Map<string, HistoricalEvent[]>();

  private static getIndex(): EventIndex {
    if (!this.index) {
      const events = HistoricalEventRegistry.getAllEvents();
      this.index = new EventIndex(events);
    }
    return this.index;
  }

  public static clearCache(): void {
    this.cache.clear();
    this.index = null;
  }

  public static getAllEvents(): HistoricalEvent[] {
    return HistoricalEventRegistry.getAllEvents();
  }

  public static getEventsForDataset(datasetId: string): HistoricalEvent[] {
    return this.getIndex().getByDataset(datasetId);
  }

  public static getEventsByCategory(category: HistoricalEventCategory): HistoricalEvent[] {
    return this.getIndex().getByCategory(category);
  }

  public static getEventsForTimeRange(start: number, end: number): HistoricalEvent[] {
    return this.getIndex().getByYearRange(start, end);
  }

  /**
   * Retrieves filtered and density-adjusted events for a specific dataset & view configuration.
   */
  public static getVisibleEvents(
    options: HistoricalFilterOptions,
    zoomSpanYears = 50,
    maxEvents = 8
  ): HistoricalEvent[] {
    const cacheKey = JSON.stringify({ options, zoomSpanYears, maxEvents });
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Fast retrieval via index if datasetId or timeRange specified
    let candidates: HistoricalEvent[];
    if (options.datasetId) {
      candidates = this.getIndex().getByDataset(options.datasetId);
    } else if (options.timeRange) {
      candidates = this.getIndex().getByYearRange(options.timeRange.start, options.timeRange.end);
    } else {
      candidates = this.getAllEvents();
    }

    // Fine-grained filter
    const filtered = EventFilter.filter(candidates, options);

    // Apply density reduction
    const visible = EventDensity.calculateVisibleEvents(filtered, zoomSpanYears, maxEvents);

    this.cache.set(cacheKey, visible);
    return visible;
  }
}
