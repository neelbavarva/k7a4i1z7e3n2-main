// Word lists that decide how a release is treated. Shared by the pipeline and the
// "How the score works" page, so the page always shows the rules actually in use.
// Matching is a case-insensitive "title contains" check.

/** Lower is the good result (the sign of the surprise flips). */
export const LOWER_IS_BETTER = ['unemployment', 'claimant count', 'jobless', 'job cuts', 'claims'];

/** Shown as risk but no number to score. */
export const NO_SIGNAL = [
  'speaks', 'speech', 'statement', 'minutes', 'press conference', 'testifies', 'summary of opinions',
  'bond auction', 'bill auction', 'inventories', 'storage', 'bulletin', 'holiday', 'daylight saving',
  'financial stability', 'quarterly report', 'monetary policy report',
];

/** Central bank policy-rate decisions. */
export const RATE_DECISION = [
  'cash rate', 'funds rate', 'bank rate', 'official bank rate', 'rate decision', 'policy rate',
  'overnight rate', 'main refinancing rate', 'deposit facility rate', 'official cash rate',
];

/** Broad release type, used by the driver profiles of metals, oil and indices (first match wins). */
export const CATEGORIES = [
  { key: 'inflation', words: ['cpi', 'ppi', 'pce', 'price index', 'inflation', 'earnings', 'wage'] },
  {
    key: 'labour',
    words: ['employment', 'non-farm', 'payroll', 'unemployment', 'claims', 'jobless', 'jolts', 'job openings', 'claimant', 'job cuts'],
  },
  {
    key: 'growth',
    words: [
      'gdp', 'pmi', 'ism', 'retail sales', 'industrial', 'production', 'durable', 'confidence', 'sentiment', 'orders',
      'spending', 'housing', 'building', 'home sales', 'starts', 'tankan', 'barometer', 'activity',
    ],
  },
];
