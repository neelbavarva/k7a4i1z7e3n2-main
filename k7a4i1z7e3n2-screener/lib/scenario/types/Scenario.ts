export type ScenarioAdjustmentType = 'absolute' | 'percentage' | 'target_value';
export type ScenarioConfidence = 'high' | 'medium' | 'low';

export interface ScenarioInput {
  datasetId: string;
  adjustmentType: ScenarioAdjustmentType;
  adjustmentValue: number; // e.g. +1.5 for 1.5% absolute increase, or +20 for +20% relative increase, or 120.0 for target
  label?: string;
}

export interface ScenarioHorizon {
  startYear: number;
  endYear: number;
  steps: number; // Number of annual projection steps
}

export interface ProjectedPoint {
  year: number;
  baseValue: number | null;
  scenarioValue: number;
  lowerBound: number;
  upperBound: number;
}

export interface HistoricalAnalogueEvidence {
  eventId: string;
  eventTitle: string;
  period: string;
  historicalChangePct: number;
  similarityScore: number;
  note: string;
}

export interface ScenarioRelationshipEvidence {
  datasetId: string;
  datasetName: string;
  correlation: number;
  relationshipStrength: string;
  lagYears: number;
  impactFactor: number;
}

export interface ScenarioResult {
  id: string;
  title: string;
  strategyId: string;
  targetDatasetId: string;
  input: ScenarioInput;
  horizon: ScenarioHorizon;
  confidence: ScenarioConfidence;
  summary: string;
  explanation: string;
  projectedSeries: ProjectedPoint[];
  historicalAnalogues: HistoricalAnalogueEvidence[];
  relationshipEvidence: ScenarioRelationshipEvidence[];
  metadata: Record<string, unknown>;
}

export interface ScenarioQueryOptions {
  seriesMap?: Record<string, (number | null)[]>;
  yearsMap?: Record<string, number[]>;
  marketKey?: string;
  metadata?: Record<string, unknown>;
}
