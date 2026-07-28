import type {
  ScenarioAdjustmentType,
  ScenarioConfidence,
  ScenarioHorizon,
  ProjectedPoint,
} from '../types/Scenario';

/**
 * Calculates target value based on adjustment type and amount.
 */
export function calculateTargetValue(
  baseValue: number,
  adjustmentType: ScenarioAdjustmentType,
  adjustmentValue: number
): number {
  switch (adjustmentType) {
    case 'absolute':
      return baseValue + adjustmentValue;
    case 'percentage':
      return baseValue * (1 + adjustmentValue / 100);
    case 'target_value':
      return adjustmentValue;
    default:
      return baseValue;
  }
}

/**
 * Generates smooth trajectory points over the scenario horizon steps.
 */
export function generateTrajectory(
  startYear: number,
  steps: number,
  baseValue: number,
  targetValue: number,
  volatilityBand: number = 0.05
): ProjectedPoint[] {
  const points: ProjectedPoint[] = [];
  const delta = (targetValue - baseValue) / Math.max(1, steps);

  for (let i = 0; i <= steps; i++) {
    const year = startYear + i;
    // Linear trajectory interpolation with progressive uncertainty envelope
    const scenarioVal = baseValue + delta * i;
    const uncertaintyFactor = Math.sqrt(i + 1) * volatilityBand * Math.abs(scenarioVal || 1);

    points.push({
      year,
      baseValue: i === 0 ? baseValue : null,
      scenarioValue: Number(scenarioVal.toFixed(2)),
      lowerBound: Number((scenarioVal - uncertaintyFactor).toFixed(2)),
      upperBound: Number((scenarioVal + uncertaintyFactor).toFixed(2)),
    });
  }

  return points;
}

/**
 * Determines projection confidence based on evidence criteria.
 */
export function evaluateConfidence(
  evidenceCount: number,
  relationshipStrength: number,
  horizonYears: number
): ScenarioConfidence {
  if (horizonYears > 10 || evidenceCount === 0) return 'low';

  const score = evidenceCount * 2 + Math.abs(relationshipStrength) * 5 - horizonYears * 0.3;
  if (score >= 6) return 'high';
  if (score >= 3) return 'medium';
  return 'low';
}
