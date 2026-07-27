export type BubbleTimelineEvent = {
  year: number;
  title: string;
  detail: string;
};

export type BubbleSource = {
  name: string;
  organization: string;
  url: string;
  note?: string;
};

export type BubbleChartPoint = {
  year: number;
  /** Source value re-expressed as peak = 100; sourceValue remains the reported observation. */
  value: number;
  sourceValue: number;
};

export type BubbleDataset = {
  id: string;
  name: string;
  benchmark: string;
  startYear: number | null;
  peakYear: number | null;
  crashYear: number | null;
  recoveryYear: number | null;
  durationYears: number | null;
  largestDrawdownPercent: number | null;
  recoveryTimeYears: number | null;
  peakValuation: string | null;
  capitalInflow: string | null;
  mainTrigger: string;
  mainCause: string;
  historicalSummary: string;
  keyLessons: string[];
  timeline: BubbleTimelineEvent[];
  chart: {
    method: string;
    points: BubbleChartPoint[];
  } | null;
  sources: BubbleSource[];
  limitations: string[];
};
