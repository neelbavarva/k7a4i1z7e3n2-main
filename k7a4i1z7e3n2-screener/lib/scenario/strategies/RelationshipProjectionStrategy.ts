import type { ScenarioStrategy } from './ScenarioStrategy';
import type {
  ScenarioInput,
  ScenarioHorizon,
  ScenarioQueryOptions,
  ScenarioResult,
  ScenarioRelationshipEvidence,
} from '../types/Scenario';
import { DATASET_REGISTRY } from '@/lib/datasets/registry';
import { RelationshipEngine } from '@/lib/relationship';
import { calculateTargetValue, generateTrajectory, evaluateConfidence } from '../utils/projection';

export class RelationshipProjectionStrategy implements ScenarioStrategy {
  public id = 'relationship-projection-strategy';
  public name = 'Relationship-Driven Scenario Projection Strategy';

  public simulate(
    targetDatasetId: string,
    input: ScenarioInput,
    horizon: ScenarioHorizon,
    options?: ScenarioQueryOptions
  ): ScenarioResult {
    const seriesMap = options?.seriesMap ?? {};
    const yearsMap = options?.yearsMap ?? {};

    const driverMeta = DATASET_REGISTRY[input.datasetId];
    const targetMeta = DATASET_REGISTRY[targetDatasetId];

    const driverName = driverMeta ? driverMeta.name : input.datasetId;
    const targetName = targetMeta ? targetMeta.name : targetDatasetId;

    const targetSeries = seriesMap[targetDatasetId] ?? [];
    const validTarget = targetSeries.filter((v): v is number => v !== null && Number.isFinite(v));
    const lastTargetVal = validTarget.length ? validTarget[validTarget.length - 1] : 100;

    // Call RelationshipEngine to evaluate statistical correlation between input driver and target dataset
    const pair = {
      datasetIdA: input.datasetId,
      datasetIdB: targetDatasetId,
      labelA: driverName,
      labelB: targetName,
    };

    const relQueryOptions = {
      seriesA: seriesMap[input.datasetId],
      yearsA: yearsMap[input.datasetId],
      seriesB: seriesMap[targetDatasetId],
      yearsB: yearsMap[targetDatasetId],
    };

    const relResult = RelationshipEngine.analyzeRelationship(pair, relQueryOptions, 'correlation-strategy');
    const leadLagResult = RelationshipEngine.analyzeRelationship(pair, relQueryOptions, 'lead-lag-strategy');

    const correlation = relResult.correlation ?? 0.5;
    const optimalLag = (leadLagResult.metadata.optimalLag as number) ?? 0;

    // Compute expected shock impact: delta_target = delta_driver * correlation
    const driverSeries = seriesMap[input.datasetId] ?? [];
    const validDriver = driverSeries.filter((v): v is number => v !== null && Number.isFinite(v));
    const lastDriverVal = validDriver.length ? validDriver[validDriver.length - 1] : 10;
    const driverTargetVal = calculateTargetValue(lastDriverVal, input.adjustmentType, input.adjustmentValue);

    const driverDeltaPct = lastDriverVal !== 0 ? ((driverTargetVal - lastDriverVal) / Math.abs(lastDriverVal)) * 100 : 0;
    const targetDeltaPct = driverDeltaPct * correlation;

    const projectedTargetVal = lastTargetVal * (1 + targetDeltaPct / 100);

    const steps = Math.max(1, horizon.endYear - horizon.startYear);
    const projectedSeries = generateTrajectory(horizon.startYear, steps, lastTargetVal, projectedTargetVal, 0.05);

    const evidence: ScenarioRelationshipEvidence[] = [
      {
        datasetId: input.datasetId,
        datasetName: driverName,
        correlation,
        relationshipStrength: relResult.strength,
        lagYears: optimalLag,
        impactFactor: Number(correlation.toFixed(2)),
      },
    ];

    const confidence = evaluateConfidence(1, correlation, steps);

    const summary = `Relationship projection estimates ${targetName} adjusting to ${projectedTargetVal.toFixed(1)} by ${horizon.endYear} in response to a ${driverDeltaPct >= 0 ? '+' : ''}${driverDeltaPct.toFixed(1)}% shift in ${driverName}.`;
    const explanation = `Historically, ${driverName} and ${targetName} demonstrate a ${relResult.strength} ${relResult.direction} correlation (r = ${correlation.toFixed(2)}). ${leadLagResult.summary}`;

    return {
      id: `scenario-rel-${input.datasetId}-to-${targetDatasetId}-${horizon.startYear}`,
      title: `Relationship Projection: ${driverName} → ${targetName}`,
      strategyId: this.id,
      targetDatasetId,
      input,
      horizon,
      confidence,
      summary,
      explanation,
      projectedSeries,
      historicalAnalogues: [],
      relationshipEvidence: evidence,
      metadata: {
        strategyId: this.id,
        correlation,
        driverDeltaPct,
        targetDeltaPct,
        projectedTargetVal,
      },
    };
  }
}
