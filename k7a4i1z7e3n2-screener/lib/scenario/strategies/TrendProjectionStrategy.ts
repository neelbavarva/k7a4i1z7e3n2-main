import type { ScenarioStrategy } from './ScenarioStrategy';
import type {
  ScenarioInput,
  ScenarioHorizon,
  ScenarioQueryOptions,
  ScenarioResult,
  ProjectedPoint,
} from '../types/Scenario';
import { DATASET_REGISTRY } from '@/lib/datasets/registry';
import { AnalysisEngine } from '@/lib/analysis/engine';
import { calculateTargetValue, generateTrajectory, evaluateConfidence } from '../utils/projection';

export class TrendProjectionStrategy implements ScenarioStrategy {
  public id = 'trend-projection-strategy';
  public name = 'Trend Continuation Projection Strategy';

  public simulate(
    targetDatasetId: string,
    input: ScenarioInput,
    horizon: ScenarioHorizon,
    options?: ScenarioQueryOptions
  ): ScenarioResult {
    const meta = DATASET_REGISTRY[targetDatasetId];
    const label = meta ? meta.name : targetDatasetId;

    const seriesMap = options?.seriesMap ?? {};
    const targetSeries = seriesMap[targetDatasetId] ?? [];
    const validValues = targetSeries.filter((v): v is number => v !== null && Number.isFinite(v));
    const lastValue = validValues.length ? validValues[validValues.length - 1] : 100;

    const targetVal = calculateTargetValue(lastValue, input.adjustmentType, input.adjustmentValue);
    const steps = Math.max(1, horizon.endYear - horizon.startYear);
    const projectedSeries: ProjectedPoint[] = generateTrajectory(horizon.startYear, steps, lastValue, targetVal, 0.04);

    const confidence = evaluateConfidence(1, 0.5, steps);

    const summary = `Scenario projects ${label} transitioning from ${lastValue.toFixed(1)} to ${targetVal.toFixed(1)} by ${horizon.endYear} based on trend trajectory adjustment.`;
    const explanation = `Under this baseline trend projection, ${label} adjusts according to specified input parameter (${input.adjustmentType}: ${input.adjustmentValue}) while preserving underlying historical trend variance.`;

    return {
      id: `scenario-trend-${targetDatasetId}-${horizon.startYear}-${horizon.endYear}`,
      title: `Trend Projection: ${label}`,
      strategyId: this.id,
      targetDatasetId,
      input,
      horizon,
      confidence,
      summary,
      explanation,
      projectedSeries,
      historicalAnalogues: [],
      relationshipEvidence: [],
      metadata: {
        strategyId: this.id,
        baselineLastValue: lastValue,
        targetProjectedValue: targetVal,
      },
    };
  }
}
