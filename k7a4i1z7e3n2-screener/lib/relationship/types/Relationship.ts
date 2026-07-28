export type RelationshipStrength = 'strong' | 'moderate' | 'weak' | 'negligible';
export type RelationshipDirection = 'positive' | 'negative' | 'none';
export type RelationshipConfidence = 'high' | 'medium' | 'low';

export interface RelationshipTimeRange {
  startYear: number;
  endYear: number;
}

export interface DatasetPair {
  datasetIdA: string;
  datasetIdB: string;
  labelA?: string;
  labelB?: string;
}

export interface RollingCorrelationPoint {
  year: number;
  correlation: number | null;
  sampleSize: number;
}

export interface LeadLagResult {
  optimalLag: number; // positive means A leads B by N years, negative means B leads A
  laggedCorrelation: number;
  interpretation: string;
  lagScan: { lag: number; correlation: number; sampleSize: number }[];
}

export interface RelationshipResult {
  id: string;
  pair: DatasetPair;
  strategyId: string;
  relationshipType: 'linear_correlation' | 'rolling_correlation' | 'lead_lag';
  correlation: number | null; // Overall Pearson r if applicable
  strength: RelationshipStrength;
  direction: RelationshipDirection;
  confidence: RelationshipConfidence;
  sampleSize: number;
  timeRange: RelationshipTimeRange | null;
  summary: string;
  metadata: Record<string, unknown>;
}

export interface RelationshipQueryOptions {
  timeRange?: RelationshipTimeRange;
  windowSize?: number; // For rolling correlation, default 10
  maxLag?: number; // For lead/lag, default 5
  /** Pre-aligned or raw time series arrays */
  seriesA?: (number | null)[];
  yearsA?: number[];
  seriesB?: (number | null)[];
  yearsB?: number[];
  metadata?: Record<string, unknown>;
}
