import type { HistoricalEvent } from '../types/HistoricalEvent';
import type { HistoricalEventCategory } from '../types/HistoricalEventCategory';
import type { TimelineEntity, TimelineEntityType } from '../types/TimelineEntity';

const CATEGORY_COLOR_MAP: Record<HistoricalEventCategory, { color: string; opacity: number }> = {
  bubble: { color: '#d97706', opacity: 0.12 },          // Amber / Gold
  recession: { color: '#dc2626', opacity: 0.14 },       // Red
  financial_crisis: { color: '#991b1b', opacity: 0.16 },// Dark Red
  pandemic: { color: '#0284c7', opacity: 0.12 },        // Sky Blue
  war: { color: '#57534e', opacity: 0.12 },             // Stone Grey
  technology: { color: '#2563eb', opacity: 0.12 },      // Royal Blue
  policy: { color: '#7c3aed', opacity: 0.12 },          // Purple / Violet
  interest_rate: { color: '#059669', opacity: 0.12 },   // Emerald
  inflation: { color: '#ea580c', opacity: 0.14 },       // Orange
  currency: { color: '#0d9488', opacity: 0.12 },        // Teal
  government: { color: '#4f46e5', opacity: 0.12 },      // Indigo
  energy: { color: '#ca8a04', opacity: 0.14 },          // Yellow / Mustard
  trade: { color: '#0891b2', opacity: 0.12 },           // Cyan
};

export class TimelineEntityAdapter {
  static toEntity(event: HistoricalEvent): TimelineEntity {
    const isRange = typeof event.endDate === 'number' && event.endDate > event.startDate;
    const type: TimelineEntityType = isRange ? 'range' : 'point';
    const styling = CATEGORY_COLOR_MAP[event.category] ?? { color: '#7c837a', opacity: 0.12 };

    return {
      id: event.id,
      type,
      start: event.startDate,
      end: event.endDate,
      importance: event.importance,
      label: event.title,
      categoryKey: event.category,
      color: styling.color,
      opacity: styling.opacity,
      metadata: {
        description: event.description,
        peakDate: event.peakDate,
        affectedDatasets: event.affectedDatasets,
        affectedCountries: event.affectedCountries,
        tags: event.tags,
        references: event.references,
      },
    };
  }

  static toEntities(events: HistoricalEvent[]): TimelineEntity[] {
    return events.map(e => this.toEntity(e));
  }
}
