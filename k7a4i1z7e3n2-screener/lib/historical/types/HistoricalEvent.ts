import type { HistoricalEventCategory } from './HistoricalEventCategory';

export interface HistoricalEventReference {
  name: string;
  organization?: string;
  url?: string;
  note?: string;
}

export interface HistoricalEvent {
  id: string;
  title: string;
  description: string;
  category: HistoricalEventCategory;
  importance: 1 | 2 | 3 | 4 | 5; // 1 = minor context, 5 = major macroeconomic landmark
  startDate: number;             // Calendar year (e.g. 1929)
  endDate: number | null;        // null if ongoing event
  peakDate?: number | null;      // Optional peak observation year
  affectedDatasets?: string[];   // Array of dataset IDs (e.g. ['gdp', 'marketCap', 'buffett']) or ['*'] for all
  affectedCountries?: string[];  // Array of country codes (e.g. ['US', 'WLD']) or ['*'] for global
  tags?: string[];
  references?: HistoricalEventReference[];
}

export interface HistoricalFilterOptions {
  datasetId?: string;
  countryCode?: string;
  timeRange?: { start: number; end: number };
  categories?: HistoricalEventCategory[];
  minImportance?: number;
  tags?: string[];
}
