export type InsightConfidence = 'high' | 'medium' | 'low';

export interface InsightReference {
  name: string;
  organization?: string;
  url?: string;
  note?: string;
}

export interface Insight {
  id: string;
  title: string;
  summary: string;
  significance: string;
  confidence: InsightConfidence;
  importance: 1 | 2 | 3 | 4 | 5;
  relatedEvents: string[];       // Array of HistoricalEvent IDs
  affectedDatasets: string[];    // Array of Dataset IDs
  tags: string[];
  references?: InsightReference[];
  metadata?: Record<string, unknown>;
}

export interface InsightQueryOptions {
  datasetId?: string;
  eventId?: string;
  timeRange?: { start: number; end: number };
  categories?: string[];
  minImportance?: number;
  tags?: string[];
  /** Pass-through payload for providers that need pre-computed data (e.g. series arrays). */
  metadata?: Record<string, unknown>;
}

