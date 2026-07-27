import type { ComparisonStrategy } from './ComparisonStrategy';
import type {
  PeriodDefinition,
  ComparisonResult,
  ComparisonQueryOptions,
  ComparisonReference,
} from '../types/Comparison';
import { HistoricalContextEngine } from '@/lib/historical';
import { StatisticalComparisonStrategy } from './StatisticalComparisonStrategy';

export class HistoricalEventComparisonStrategy implements ComparisonStrategy {
  public id = 'historical-event-comparison-strategy';
  public name = 'Historical Event Comparison Strategy';

  public compare(
    periodA: PeriodDefinition,
    periodB: PeriodDefinition,
    options?: ComparisonQueryOptions
  ): ComparisonResult {
    const baseStatStrategy = new StatisticalComparisonStrategy();
    const statResult = baseStatStrategy.compare(periodA, periodB, options);

    const events = HistoricalContextEngine.getAllEvents();
    const eventA = periodA.eventId ? events.find(e => e.id === periodA.eventId) ?? null : null;
    const eventB = periodB.eventId ? events.find(e => e.id === periodB.eventId) ?? null : null;


    const references: ComparisonReference[] = [];
    if (eventA?.references) {
      eventA.references.forEach(ref => references.push({ ...ref, note: `Ref from ${eventA.title}` }));
    }
    if (eventB?.references) {
      eventB.references.forEach(ref => references.push({ ...ref, note: `Ref from ${eventB.title}` }));
    }

    const titleA = eventA ? eventA.title : periodA.name;
    const titleB = eventB ? eventB.title : periodB.name;

    const eventContextNote = eventA && eventB
      ? ` Comparing historical context: "${eventA.description}" (${eventA.category}) vs "${eventB.description}" (${eventB.category}).`
      : '';

    return {
      ...statResult,
      id: `comparison-event-${periodA.id}-vs-${periodB.id}`,
      title: `Event Comparison: ${titleA} vs ${titleB}`,
      summary: `${statResult.summary}${eventContextNote}`,
      relatedEvents: Array.from(new Set([
        ...statResult.relatedEvents,
        ...(eventA ? [eventA.id] : []),
        ...(eventB ? [eventB.id] : []),
      ])),
      references,
      metadata: {
        ...statResult.metadata,
        strategyId: this.id,
        eventAImportance: eventA?.importance,
        eventBImportance: eventB?.importance,
        eventACategory: eventA?.category,
        eventBCategory: eventB?.category,
      },
    };
  }
}
