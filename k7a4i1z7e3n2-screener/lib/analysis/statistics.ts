/**
 * Pure statistical utility functions for macroeconomic analysis.
 */

export function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function variance(values: number[]): number {
  if (!values.length) return 0;
  const avg = mean(values);
  return values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
}

export function standardDeviation(values: number[]): number {
  return Math.sqrt(variance(values));
}

export function zScore(value: number, meanVal: number, stdDevVal: number): number {
  if (stdDevVal === 0) return 0;
  return (value - meanVal) / stdDevVal;
}

export function movingAverage(values: (number | null)[], windowSize: number): (number | null)[] {
  return values.map((_, index) => {
    const window = values.slice(Math.max(0, index - windowSize + 1), index + 1).filter((v): v is number => v !== null);
    return window.length > 0 ? mean(window) : null;
  });
}

export function linearRegression(x: number[], y: number[]): { slope: number; intercept: number; rSquared: number } {
  const n = Math.min(x.length, y.length);
  if (n < 2) return { slope: 0, intercept: y[0] ?? 0, rSquared: 0 };

  const xMean = mean(x);
  const yMean = mean(y);

  let num = 0;
  let denX = 0;
  let denY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - xMean;
    const dy = y[i] - yMean;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }

  if (denX === 0) return { slope: 0, intercept: yMean, rSquared: 0 };

  const slope = num / denX;
  const intercept = yMean - slope * xMean;
  const rSquared = denY === 0 ? 1 : (num * num) / (denX * denY);

  return { slope, intercept, rSquared };
}

export function trendLine(values: (number | null)[]): { trendValues: (number | null)[]; slope: number; intercept: number; rSquared: number } {
  const validPoints: { index: number; value: number }[] = [];
  values.forEach((v, index) => {
    if (v !== null && Number.isFinite(v)) {
      validPoints.push({ index, value: v });
    }
  });

  if (validPoints.length < 2) {
    return { trendValues: values.map(() => null), slope: 0, intercept: 0, rSquared: 0 };
  }

  const x = validPoints.map(p => p.index);
  const y = validPoints.map(p => p.value);
  const reg = linearRegression(x, y);

  const trendValues = values.map((_, index) => reg.slope * index + reg.intercept);

  return {
    trendValues,
    slope: reg.slope,
    intercept: reg.intercept,
    rSquared: reg.rSquared,
  };
}

export function percentile(values: number[], targetValue: number): number {
  if (!values.length) return 0;
  const count = values.filter(v => v < targetValue).length;
  const equalCount = values.filter(v => v === targetValue).length;
  return Math.min(100, Math.max(0, ((count + 0.5 * equalCount) / values.length) * 100));
}

export function quantile(values: number[], q: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}
