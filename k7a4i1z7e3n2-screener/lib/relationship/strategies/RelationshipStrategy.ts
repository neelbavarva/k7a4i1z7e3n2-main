import type { DatasetPair, RelationshipQueryOptions, RelationshipResult } from '../types/Relationship';

export interface RelationshipStrategy {
  id: string;
  name: string;
  compute(pair: DatasetPair, options: RelationshipQueryOptions): RelationshipResult;
}
