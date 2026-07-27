import type { InsightProvider } from '../providers/InsightProvider';
import type { Insight, InsightQueryOptions } from '../types/Insight';
import { RuleBasedInsightProvider } from '../providers/RuleBasedInsightProvider';
import { StatisticalInsightProvider } from '../providers/StatisticalInsightProvider';
import { HistoricalPercentileProvider } from '../providers/HistoricalPercentileProvider';
import { ThresholdProvider } from '../providers/ThresholdProvider';
import { TrendProvider } from '../providers/TrendProvider';
import { HistoricalComparisonProvider } from '../providers/HistoricalComparisonProvider';

export class InsightRegistry {
  private static providers = new Map<string, InsightProvider>();
  private static initialized = false;

  private static initialize(): void {
    if (this.initialized) return;
    this.registerProvider(new RuleBasedInsightProvider());
    this.registerProvider(new StatisticalInsightProvider());
    this.registerProvider(new HistoricalPercentileProvider());
    this.registerProvider(new ThresholdProvider());
    this.registerProvider(new TrendProvider());
    this.registerProvider(new HistoricalComparisonProvider());
    this.initialized = true;
  }

  public static registerProvider(provider: InsightProvider): void {
    this.providers.set(provider.id, provider);
  }

  public static unregisterProvider(providerId: string): void {
    this.providers.delete(providerId);
  }

  public static getProviders(): InsightProvider[] {
    this.initialize();
    return Array.from(this.providers.values());
  }

  public static queryAllProviders(query?: InsightQueryOptions): Insight[] {
    this.initialize();
    const allInsights: Insight[] = [];
    this.providers.forEach(provider => {
      const results = provider.generateInsights(query);
      allInsights.push(...results);
    });
    return allInsights;
  }
}
