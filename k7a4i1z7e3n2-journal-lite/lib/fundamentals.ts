// Whether a trade was backed by more than the chart: fundamentals, the news, data or an event
// coming up. Technical reasons don't count here. The API has no field for it, so it lives in the
// old set-and-forget fields: setForget is the answer, and setForgetDecided says it has been given
// (the API sets that on the first update). A new trade always answers it, yes or no.

import type { Trade } from './types';

export const FUND_LABEL = 'Backed by fundamentals';

/** true or false once answered, null for older trades that never were. */
export const fundOf = (t: Pick<Trade, 'setForget' | 'setForgetDecided'>): boolean | null => (t.setForgetDecided ? t.setForget : null);

export const fundPatch = (backed: boolean): Pick<Trade, 'setForget'> => ({ setForget: backed });

export const FUND_HINT = {
  ask: 'News, data or an event coming up, not just the chart.',
  yes: 'A fundamental or news reason stood behind it.',
  no: 'Chart only: no fundamental or news reason.',
  unset: 'Not answered yet: was there a fundamental or news reason?',
};

export const fundHint = (v: boolean | null) => (v === null ? FUND_HINT.unset : v ? FUND_HINT.yes : FUND_HINT.no);
