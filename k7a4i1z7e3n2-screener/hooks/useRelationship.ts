'use client';

import { useMemo } from 'react';
import type {
  DatasetPair,
  RelationshipQueryOptions,
  RelationshipResult,
} from '@/lib/relationship';
import { RelationshipEngine } from '@/lib/relationship';

export interface UseRelationshipResult {
  result: RelationshipResult | null;
  allResults: RelationshipResult[];
  isLoading: boolean;
  error: string | null;
}

export function useRelationship(
  pair: DatasetPair | null,
  seriesA: (number | null)[] | undefined,
  yearsA: number[] | undefined,
  seriesB: (number | null)[] | undefined,
  yearsB: number[] | undefined,
  options?: Partial<RelationshipQueryOptions>,
  strategyId?: string
): UseRelationshipResult {
  return useMemo(() => {
    if (!pair || !seriesA || !yearsA || !seriesB || !yearsB) {
      return {
        result: null,
        allResults: [],
        isLoading: false,
        error: null,
      };
    }

    if (seriesA.length < 3 || seriesB.length < 3) {
      return {
        result: null,
        allResults: [],
        isLoading: false,
        error: 'Insufficient data points (minimum 3 required).',
      };
    }

    try {
      const queryOptions: RelationshipQueryOptions = {
        ...options,
        seriesA,
        yearsA,
        seriesB,
        yearsB,
      };

      const result = RelationshipEngine.analyzeRelationship(pair, queryOptions, strategyId);
      const allResults = RelationshipEngine.analyzeAllRelationships(pair, queryOptions);

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
        error: err instanceof Error ? err.message : 'Failed to analyze relationship.',
      };
    }
  }, [
    pair?.datasetIdA,
    pair?.datasetIdB,
    pair?.labelA,
    pair?.labelB,
    seriesA,
    yearsA,
    seriesB,
    yearsB,
    options?.windowSize,
    options?.maxLag,
    options?.timeRange?.startYear,
    options?.timeRange?.endYear,
    strategyId,
  ]);
}
