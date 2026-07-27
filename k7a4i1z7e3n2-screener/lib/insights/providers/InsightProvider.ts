import type { Insight, InsightQueryOptions } from '../types/Insight';

export interface InsightProvider {
  id: string;
  name: string;
  generateInsights(query?: InsightQueryOptions): Insight[];
}
