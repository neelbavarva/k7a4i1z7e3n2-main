// Website timing, shared by the app and the "How the score works" page.
export const STALE_HOURS = 3; // the data job runs hourly; warn after a few missed runs
export const POLL_MINUTES = 10; // the deployed site quietly checks for new scores this often
export const REFRESH_COOLDOWN_S = 60; // the Refresh button rests this long after each use
export const CAL_POLL_MINUTES = 10; // the Calendar page checks the live feed this often while open
export const CAL_CACHE_MINUTES = 10; // how long /api/calendar's answer is reused before the feed is asked again
export const COLLECT_REST_MINUTES = 5; // Refresh doesn't start a new data run within this long of the last one finishing
export const COLLECT_TIMEOUT_MINUTES = 10; // Refresh stops waiting for a data run after this long
