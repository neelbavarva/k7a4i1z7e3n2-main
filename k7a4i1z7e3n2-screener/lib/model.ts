/**
 * Every setting the screener's numbers depend on. The dashboard, the analysis engine and
 * the How it works page all read from here, so the explanation can't drift from what the
 * site computes.
 */

/** Timeframe presets. The data is annual, so a 1-year window would be a single point. */
export const TIMEFRAMES = [5, 10, 20, 30, 50, 'MAX'] as const;

/** Buffett indicator band: a trailing average of this many years, ± this many standard deviations. */
export const BUFFETT_BAND = { windowYears: 10, deviations: 2 } as const;

/** Valuation status: how far (in standard deviations of the band window) counts as stretched or extreme. */
export const VALUATION_Z = { stretched: 1.2, extreme: 2.5 } as const;

/** The brief calls the Buffett indicator "in line" with its average when it's within this many points. */
export const BUFFETT_IN_LINE_PTS = 2;

/** The Buffett gauge in Compared markets runs from 0 to this, with 100% in the middle. */
export const GAUGE_MAX_PCT = 200;

/** GDP and market value status: further than this from the straight-line trend is above / below trend. */
export const TREND_BAND_PCT = 1.5;

/** Growth status: latest year against the average of this many years, with a dead band in points. */
export const GROWTH_STATUS = { windowYears: 5, deadBandPts: 0.5 } as const;

/** AI flow: the dashed baseline is a trailing average of this many observed years. */
export const AI_BASELINE_YEARS = 5;

/** AI flow table: the "growth a year" column compounds over this many years. */
export const AI_GROWTH_YEARS = 5;

/** Server-side cache for every upstream request. */
export const CACHE_HOURS = 24;
