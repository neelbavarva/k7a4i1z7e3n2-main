// A trade's pace: whether it was rushed, dragged, or taken on pace (the default, not marked).
// The API has no field for it, so it lives in the old King fields: isKing says a trade is marked,
// kingDescription says how ("RUSHING" or "DRAGGING"). Anything else there, such as an old King
// note, reads as on pace. Every trade type can carry one: real, demo and missed.

import type { Trade } from './types';

export type Pace = 'RUSHING' | 'DRAGGING';
/** A pace, or null for on pace (not marked). */
export type PaceOrNone = Pace | null;

export const PACES: Pace[] = ['RUSHING', 'DRAGGING'];

export const PACE_LABEL: Record<Pace, string> = { RUSHING: 'Rushing', DRAGGING: 'Dragging' };
export const ON_PACE = 'On pace';

export const PACE_HINT: Record<Pace | 'NONE', string> = {
  NONE: 'Taken at the right moment: no rush, no hesitation.',
  RUSHING: 'Forced it: in too early, too fast, too eager.',
  DRAGGING: 'Held back: in too late, hesitated, or let it drag on.',
};

export const isPace = (v: unknown): v is Pace => v === 'RUSHING' || v === 'DRAGGING';

export function paceOf(t: Pick<Trade, 'isKing' | 'kingDescription'>): PaceOrNone {
  if (!t.isKing) return null;
  const v = (t.kingDescription || '').trim().toUpperCase();
  return isPace(v) ? v : null;
}

/** The update that sets a pace (or clears it). */
export const pacePatch = (p: PaceOrNone): Pick<Trade, 'isKing' | 'kingDescription'> =>
  p ? { isKing: true, kingDescription: p } : { isKing: false, kingDescription: null };

/** "rushing", "dragging" or "none", for class names and data attributes. */
export const paceKey = (p: PaceOrNone) => (p ? p.toLowerCase() : 'none');
