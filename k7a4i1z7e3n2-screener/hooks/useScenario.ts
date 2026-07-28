'use client';

import { useMemo } from 'react';
import type {
  ScenarioInput,
  ScenarioHorizon,
  ScenarioQueryOptions,
  ScenarioResult,
} from '@/lib/scenario';
import { ScenarioEngine } from '@/lib/scenario';

export interface UseScenarioResult {
  result: ScenarioResult | null;
  allResults: ScenarioResult[];
  isLoading: boolean;
  error: string | null;
}

export function useScenario(
  targetDatasetId: string | null,
  input: ScenarioInput | null,
  horizon: ScenarioHorizon | null,
  options?: ScenarioQueryOptions,
  strategyId?: string
): UseScenarioResult {
  return useMemo(() => {
    if (!targetDatasetId || !input || !horizon) {
      return {
        result: null,
        allResults: [],
        isLoading: false,
        error: null,
      };
    }

    try {
      const result = ScenarioEngine.simulateScenario(
        targetDatasetId,
        input,
        horizon,
        options,
        strategyId
      );

      const allResults = ScenarioEngine.simulateAllScenarios(
        targetDatasetId,
        input,
        horizon,
        options
      );

      return {
        result,
        allResults,
        isLoading: false,
        error: null,
      };
    } catch (err) {
      return {
        result: null,
        allResults: [],
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to execute scenario simulation.',
      };
    }
  }, [
    targetDatasetId,
    input?.datasetId,
    input?.adjustmentType,
    input?.adjustmentValue,
    horizon?.startYear,
    horizon?.endYear,
    horizon?.steps,
    options?.marketKey,
    strategyId,
  ]);
}
