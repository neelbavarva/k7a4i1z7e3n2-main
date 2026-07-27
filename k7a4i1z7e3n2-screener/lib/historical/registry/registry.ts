import type { HistoricalEvent } from '../types/HistoricalEvent';
import type { HistoricalEventCategory } from '../types/HistoricalEventCategory';

import bubbles from '../events/bubbles.json';
import recessions from '../events/recessions.json';
import pandemics from '../events/pandemics.json';
import wars from '../events/wars.json';
import technology from '../events/technology.json';
import policy from '../events/policy.json';
import monetary from '../events/monetary.json';

export class HistoricalEventRegistry {
  private static events: HistoricalEvent[] = [];
  private static initialized = false;

  private static initialize(): void {
    if (this.initialized) return;
    this.events = [
      ...(bubbles as HistoricalEvent[]),
      ...(recessions as HistoricalEvent[]),
      ...(pandemics as HistoricalEvent[]),
      ...(wars as HistoricalEvent[]),
      ...(technology as HistoricalEvent[]),
      ...(policy as HistoricalEvent[]),
      ...(monetary as HistoricalEvent[]),
    ];
    this.initialized = true;
  }

  static registerEvent(event: HistoricalEvent): void {
    this.initialize();
    if (!this.events.some(e => e.id === event.id)) {
      this.events.push(event);
    }
  }

  static registerEvents(events: HistoricalEvent[]): void {
    this.initialize();
    events.forEach(e => this.registerEvent(e));
  }

  static getAllEvents(): HistoricalEvent[] {
    this.initialize();
    return [...this.events];
  }

  static getEventsForDataset(datasetId: string): HistoricalEvent[] {
    this.initialize();
    return this.events.filter(e => {
      if (!e.affectedDatasets || e.affectedDatasets.includes('*')) return true;
      return e.affectedDatasets.includes(datasetId);
    });
  }

  static getEventsByCategory(category: HistoricalEventCategory): HistoricalEvent[] {
    this.initialize();
    return this.events.filter(e => e.category === category);
  }

  static getEventsForTimeRange(start: number, end: number): HistoricalEvent[] {
    this.initialize();
    return this.events.filter(e => {
      const eEnd = e.endDate ?? e.startDate;
      return e.startDate <= end && eEnd >= start;
    });
  }
}
