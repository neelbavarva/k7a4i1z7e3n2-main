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

/** Episodes with a path to draw. */
export const CHARTED_BUBBLES = BUBBLE_LIBRARY.filter(bubble => (bubble.chart?.points.length ?? 0) > 1);

/** The year a path peaks: the stated peak year, or the year its index is highest. */
const peakOf = (bubble: BubbleDataset) =>
  bubble.peakYear ?? bubble.chart!.points.reduce((best, point) => (point.value > best.value ? point : best)).year;

/**
 * The library chart lines every episode up on its own peak (year 0), so shapes compare
 * directly. Every year in between gets a slot, so the axis is to scale.
 */
const offsets = CHARTED_BUBBLES.flatMap(bubble => bubble.chart!.points.map(point => point.year - peakOf(bubble)));
export const BUBBLE_OFFSETS = Array.from({ length: Math.max(...offsets) - Math.min(...offsets) + 1 }, (_, i) => Math.min(...offsets) + i);

export const bubbleOffsetLabel = (offset: number) => (offset === 0 ? 'Peak' : `${offset > 0 ? '+' : '−'}${Math.abs(offset)}y`);
export const bubbleOffsetTip = (offset: number) =>
  offset === 0 ? 'The peak' : `${Math.abs(offset)} year${Math.abs(offset) === 1 ? '' : 's'} ${offset > 0 ? 'after' : 'before'} the peak`;

/** A bubble's path by years from its peak. */
export const bubblePathByOffset = (bubble: BubbleDataset) =>
  new Map(bubble.chart!.points.map(point => [point.year - peakOf(bubble), point.value]));
