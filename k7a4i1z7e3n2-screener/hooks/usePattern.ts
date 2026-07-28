'use client';

import { useMemo } from 'react';
import type { PatternQueryOptions, PatternResult } from '@/lib/pattern';
import { PatternEngine } from '@/lib/pattern';

export interface UsePatternResult {
  result: PatternResult | null;
  allResults: PatternResult[];
  isLoading: boolean;
  error: string | null;
}

export function usePattern(
  options?: PatternQueryOptions,
  strategyId?: string
): UsePatternResult {
  return useMemo(() => {
    try {
      const result = PatternEngine.findPatterns(options, strategyId);
      const allResults = PatternEngine.findPatternsAllStrategies(options);

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
        error: err instanceof Error ? err.message : 'Failed to execute pattern analysis.',
      };
    }
  }, [
    options?.currentYear,
    options?.windowSizeYears,
    options?.limit,
    options?.marketKey,
    options?.targetDatasets?.join(','),
    JSON.stringify(options?.weights ?? {}),
    strategyId,
  ]);
}
