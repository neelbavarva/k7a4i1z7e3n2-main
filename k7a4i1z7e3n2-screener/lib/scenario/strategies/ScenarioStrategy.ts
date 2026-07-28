import type {
  ScenarioInput,
  ScenarioHorizon,
  ScenarioQueryOptions,
  ScenarioResult,
} from '../types/Scenario';

export interface ScenarioStrategy {
  id: string;
  name: string;
  simulate(
    targetDatasetId: string,
    input: ScenarioInput,
    horizon: ScenarioHorizon,
    options?: ScenarioQueryOptions
  ): ScenarioResult;
}
