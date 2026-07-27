import type { HistoricalEvent } from '../types/HistoricalEvent';

export class EventDensity {
  /**
   * Calculates which events are visible based on importance, zoom span, and minimum event spacing threshold.
   *
   * @param events Candidate events sorted or unsorted
   * @param zoomSpanYears The total width of the visible timeframe in years (e.g. 10, 50, 100)
   * @param maxVisibleEvents Maximum number of events to select for density control
   * @returns Array of prioritized, visible HistoricalEvents
   */
  static calculateVisibleEvents(
    events: HistoricalEvent[],
    zoomSpanYears = 50,
    maxVisibleEvents = 8
  ): HistoricalEvent[] {
    if (!events.length) return [];

    // Sort by importance descending, then by start date
    const sorted = [...events].sort((a, b) => {
      if (b.importance !== a.importance) {
        return b.importance - a.importance;
      }
      return a.startDate - b.startDate;
    });

    const selected: HistoricalEvent[] = [];
    const minYearGap = Math.max(1, Math.floor(zoomSpanYears / Math.max(1, maxVisibleEvents)));

    for (const candidate of sorted) {
      if (selected.length >= maxVisibleEvents) break;

      // Ensure event isn't too close in time to an already selected event of equal/higher importance
      const hasConflict = selected.some(s => Math.abs(s.startDate - candidate.startDate) < minYearGap);
      if (!hasConflict || candidate.importance === 5) {
        selected.push(candidate);
      }
    }

    // Return in chronological order
    return selected.sort((a, b) => a.startDate - b.startDate);
  }
}
