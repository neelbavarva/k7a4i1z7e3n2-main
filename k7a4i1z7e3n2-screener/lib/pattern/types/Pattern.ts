export type PatternMatchConfidence = 'high' | 'medium' | 'low';

export type DatasetWeightMap = Record<string, number>; // e.g. { gdp: 1.0, marketCap: 1.2, buffett: 1.5 }

export interface MatchingFactor {
  datasetId: string;
  datasetName: string;
  similarityScore: number; // 0 to 100
  currentMetric: string;
  historicalMetric: string;
  description: string;
}

export interface DifferingFactor {
  datasetId: string;
  datasetName: string;
  divergenceScore: number; // 0 to 100
  currentMetric: string;
  historicalMetric: string;
  description: string;
}

export interface PatternMatch {
  id: string;
  rank: number;
  periodName: string;
  startYear: number;
  endYear: number;
  similarityScore: number; // 0 to 100
  confidence: PatternMatchConfidence;
  explanation: string;
  matchingFactors: MatchingFactor[];
  differingFactors: DifferingFactor[];
  supportingEvents: string[]; // Historical event IDs
  relationshipEvidence?: string;
  metadata: Record<string, unknown>;
}

export interface PatternResult {
  id: string;
  title: string;
  strategyId: string;
  currentRegimeSummary: string;
  topMatches: PatternMatch[];
  confidence: PatternMatchConfidence;
  explanation: string;
  metadata: Record<string, unknown>;
}

export interface PatternQueryOptions {
  currentYear?: number;
  windowSizeYears?: number; // Default 5 years
  targetDatasets?: string[];
  weights?: DatasetWeightMap;
  limit?: number; // Top N matches, default 5
  seriesMap?: Record<string, (number | null)[]>;
  yearsMap?: Record<string, number[]>;
  marketKey?: string;
  metadata?: Record<string, unknown>;
}
