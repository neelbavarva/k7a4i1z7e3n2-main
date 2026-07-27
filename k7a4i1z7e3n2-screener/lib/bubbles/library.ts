import dotcom from '@/data/bubbles/dotcom.json';
import housing from '@/data/bubbles/housing.json';
import japan from '@/data/bubbles/japan.json';
import crypto2021 from '@/data/bubbles/crypto2021.json';
import type { BubbleDataset } from '@/types/bubbles';

/**
 * Historical bubbles are intentionally static and version controlled. They do
 * not share the World Bank/OECD fetching or cache path, and are never filtered
 * by the dashboard's market or timeframe controls.
 */
export const BUBBLE_LIBRARY = [dotcom, housing, japan, crypto2021] as BubbleDataset[];

export const BUBBLE_CHART_YEARS = Array.from(new Set(
  BUBBLE_LIBRARY.flatMap(bubble => bubble.chart?.points.map(point => point.year) ?? [])
)).sort((left, right) => left - right);
