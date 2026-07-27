'use client';

import { LightweightChart } from './lightweight-chart';

export function Chart({ option, className = '', resetKey = 0 }: { option: Record<string, unknown>; className?: string; resetKey?: number }) {
  // Re-mounting is intentional: it restores the chart's initial visible
  // range, crosshair state and scale without touching the selected dataset.
  return <LightweightChart key={resetKey} option={option} className={className} resetKey={resetKey} />;
}
