export type AnalysisModelType =
  | 'trend'
  | 'valuation_band'
  | 'rolling_average'
  | 'percentile'
  | 'deviation';

export interface AnalysisResult {
  datasetId: string;
  analysisType: AnalysisModelType;
  currentValue: number | null;
  referenceValue: number | null;
  distanceFromReference: number | null; // percentage or absolute difference
  percentileRank: number | null;         // 0 to 100
  zScore: number | null;
  statusLabel: string;                   // Short human-readable status (e.g., "Above Trend (+8.2%)", "Fair Value")
  trendDirection?: 'up' | 'down' | 'flat';
  trendStrength?: 'strong' | 'moderate' | 'weak';
  summary: string;
  confidence: 'high' | 'medium' | 'low';
  metrics?: Record<string, number | string | null>;
}
