import type { PatternQueryOptions, PatternResult } from '../types/Pattern';

export interface PatternStrategy {
  id: string;
  name: string;
  findPatterns(options?: PatternQueryOptions): PatternResult;
}
