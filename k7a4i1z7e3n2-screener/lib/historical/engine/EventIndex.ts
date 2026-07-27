import type { HistoricalEvent } from '../types/HistoricalEvent';
import type { HistoricalEventCategory } from '../types/HistoricalEventCategory';

export class EventIndex {
  private byDataset = new Map<string, Set<HistoricalEvent>>();
  private byCategory = new Map<HistoricalEventCategory, Set<HistoricalEvent>>();
  private byCountry = new Map<string, Set<HistoricalEvent>>();
  private byYear = new Map<number, Set<HistoricalEvent>>();

  constructor(events: HistoricalEvent[]) {
    this.build(events);
  }

  public build(events: HistoricalEvent[]): void {
    this.byDataset.clear();
    this.byCategory.clear();
    this.byCountry.clear();
    this.byYear.clear();

    for (const event of events) {
      // Index by dataset
      if (!event.affectedDatasets || event.affectedDatasets.includes('*')) {
        this.addToMap(this.byDataset, '*', event);
      } else {
        event.affectedDatasets.forEach(ds => this.addToMap(this.byDataset, ds, event));
      }

      // Index by category
      this.addToMap(this.byCategory, event.category, event);

      // Index by country
      if (!event.affectedCountries || event.affectedCountries.includes('*')) {
        this.addToMap(this.byCountry, '*', event);
      } else {
        event.affectedCountries.forEach(c => this.addToMap(this.byCountry, c, event));
      }

      // Index by year span
      const start = event.startDate;
      const end = event.endDate ?? event.startDate;
      for (let y = start; y <= end; y++) {
        this.addToMap(this.byYear, y, event);
      }
    }
  }

  public getByDataset(datasetId: string): HistoricalEvent[] {
    const globalSet = this.byDataset.get('*') ?? new Set();
    const specificSet = this.byDataset.get(datasetId) ?? new Set();
    return Array.from(new Set([...globalSet, ...specificSet]));
  }

  public getByCategory(category: HistoricalEventCategory): HistoricalEvent[] {
    return Array.from(this.byCategory.get(category) ?? []);
  }

  public getByYearRange(start: number, end: number): HistoricalEvent[] {
    const results = new Set<HistoricalEvent>();
    for (let y = start; y <= end; y++) {
      const yearSet = this.byYear.get(y);
      if (yearSet) {
        yearSet.forEach(e => results.add(e));
      }
    }
    return Array.from(results);
  }

  private addToMap<K, V>(map: Map<K, Set<V>>, key: K, value: V): void {
    let set = map.get(key);
    if (!set) {
      set = new Set<V>();
      map.set(key, set);
    }
    set.add(value);
  }
}
