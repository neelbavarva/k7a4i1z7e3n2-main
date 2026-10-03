// Website timing, shared by the app and the "How the score works" page.
export const STALE_HOURS = 3; // the data job runs hourly; warn after a few missed runs
export const POLL_MINUTES = 10; // the deployed site quietly checks for new scores this often
export const REFRESH_COOLDOWN_S = 60; // the Refresh button rests this long after each use
