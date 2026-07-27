import type { HistoricalEvent, HistoricalFilterOptions } from '../types/HistoricalEvent';

export class EventFilter {
  static filter(events: HistoricalEvent[], options: HistoricalFilterOptions): HistoricalEvent[] {
    return events.filter(e => {
      // Dataset filter
      if (options.datasetId && e.affectedDatasets && !e.affectedDatasets.includes('*') && !e.affectedDatasets.includes(options.datasetId)) {
        return false;
      }

      // Country filter
      if (options.countryCode && e.affectedCountries && !e.affectedCountries.includes('*') && !e.affectedCountries.includes(options.countryCode)) {
        return false;
      }

      // Time range filter
      if (options.timeRange) {
        const eventEnd = e.endDate ?? e.startDate;
        if (e.startDate > options.timeRange.end || eventEnd < options.timeRange.start) {
          return false;
        }
      }

      // Category filter
      if (options.categories && options.categories.length > 0) {
        if (!options.categories.includes(e.category)) {
          return false;
        }
      }

      // Importance filter
      if (options.minImportance !== undefined && options.minImportance > 0) {
        if (e.importance < options.minImportance) {
          return false;
        }
      }

      // Tags filter
      if (options.tags && options.tags.length > 0) {
        if (!e.tags || !options.tags.some(t => e.tags!.includes(t))) {
          return false;
        }
      }

      return true;
    });
  }
}
