import type { PatternStrategy } from './PatternStrategy';
import type { PatternQueryOptions, PatternResult } from '../types/Pattern';
import { CompositeSimilarityStrategy } from './CompositeSimilarityStrategy';
import { HistoricalContextEngine } from '@/lib/historical';
import { RelationshipEngine } from '@/lib/relationship';

export class HistoricalPatternStrategy implements PatternStrategy {
  public id = 'historical-pattern-strategy';
  public name = 'Historical Macro Landmark Pattern Strategy';

  public findPatterns(options?: PatternQueryOptions): PatternResult {
    const baseStrategy = new CompositeSimilarityStrategy();
    const baseResult = baseStrategy.findPatterns(options);

    const seriesMap = options?.seriesMap ?? {};
    const yearsMap = options?.yearsMap ?? {};

    // Enhance top matches with landmark event context and statistical relationship evidence
    const events = HistoricalContextEngine.getAllEvents();

    const enhancedMatches = baseResult.topMatches.map(match => {
      const landmark = events.find(e =>
        e.startDate <= match.endYear && (e.endDate === null || e.endDate >= match.startYear)
      );

      let relEvidence = '';
      if (seriesMap.gdp && seriesMap.marketCap && yearsMap.gdp && yearsMap.marketCap) {
        const pair = { datasetIdA: 'gdp', datasetIdB: 'marketCap', labelA: 'GDP', labelB: 'Market Cap' };
        const rel = RelationshipEngine.analyzeRelationship(pair, {
          seriesA: seriesMap.gdp,
          yearsA: yearsMap.gdp,
          seriesB: seriesMap.marketCap,
          yearsB: yearsMap.marketCap,
          timeRange: { startYear: match.startYear, endYear: match.endYear },
        });
        relEvidence = rel.summary;
      }

      return {
        ...match,
        explanation: landmark
          ? `${match.explanation} Coincides with ${landmark.title} (${landmark.category}).`
          : match.explanation,
        relationshipEvidence: relEvidence || undefined,
      };
    });

    const landmarkCount = events.length;

    return {
      ...baseResult,
      id: `pattern-historical-landmark-${Date.now()}`,
      title: `Historical Landmark Regime Pattern Search`,
      strategyId: this.id,
      topMatches: enhancedMatches,
      explanation: `${baseResult.explanation} Cross-referenced against ${landmarkCount} major historical macroeconomic landmarks.`,
      metadata: {
        ...baseResult.metadata,
        strategyId: this.id,
        historicalLandmarksEvaluated: landmarkCount,
      },
    };
  }
}
