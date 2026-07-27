export interface PeriodDefinition {
  id: string;
  name: string;
  startYear: number;
  endYear: number;
  description?: string;
  eventId?: string;
}

export interface PeriodStats {
  mean: number;
  min: number;
  max: number;
  stdDev: number;
  endValue: number;
}

export interface DatasetComparison {
  datasetId: string;
  datasetName: string;
  unit: string;
  periodAStats: PeriodStats;
  periodBStats: PeriodStats;
  absoluteDifference: number;
  percentageDifference: number;
  zScoreDistance: number;
  similarityScore: number; // 0 to 100
  similarityLabel: 'high' | 'moderate' | 'low';
  significance: string;
}

export interface ComparisonReference {
  name: string;
  organization?: string;
  url?: string;
  note?: string;
}

export interface ComparisonResult {
  id: string;
  title: string;
  periodA: PeriodDefinition;
  periodB: PeriodDefinition;
  overallSimilarity: number; // 0 to 100
  similarityLabel: 'high' | 'moderate' | 'low';
  summary: string;
  datasetComparisons: DatasetComparison[];
  relatedEvents: string[];
  references: ComparisonReference[];
  metadata: Record<string, unknown>;
}

export interface ComparisonQueryOptions {
  datasetIds?: string[];
  timeRangeA?: { start: number; end: number };
  timeRangeB?: { start: number; end: number };
  eventIdA?: string;
  eventIdB?: string;
  /** Pre-computed time series maps passed by caller. */
  metadata?: {
    seriesMap?: Record<string, number[]>;
    yearsMap?: Record<string, number[]>;
    [key: string]: unknown;
  };
}
