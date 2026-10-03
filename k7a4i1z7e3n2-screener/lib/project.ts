/** The engines behind the screener, in the order data flows through them. `onScreen` marks the ones the dashboard uses today. */
export const ENGINES = [
  { name: 'Datasets', desc: 'Registry and metadata: what each series is, its unit, its renderer', onScreen: true },
  { name: 'Compatibility', desc: 'Which series can share an axis, and indexing when they can’t', onScreen: true },
  { name: 'Analysis', desc: 'Trend, valuation band and growth status for each series', onScreen: true },
  { name: 'Historical context', desc: 'Event index, density and timeline rendering', onScreen: false },
  { name: 'Insights', desc: 'Rule, threshold and percentile readings', onScreen: false },
  { name: 'Historical comparison', desc: 'Lining a series up against past periods and events', onScreen: false },
  { name: 'Relationship', desc: 'Correlation, rolling correlation and lead / lag', onScreen: false },
  { name: 'Scenario', desc: 'Trend, relationship and analogue projections', onScreen: false },
  { name: 'Pattern', desc: 'Matching today’s mix of readings to past environments', onScreen: false },
] as const;

export const ROADMAP = [
  { phase: 'Phase 0', title: 'Repository integrity audit', done: true },
  { phase: 'Phase 1', title: 'Macro data foundation', done: true },
  { phase: 'Phase 2', title: 'AI capital flow and valuation', done: true },
  { phase: 'Phase 3A', title: 'Bubble benchmark library', done: true },
  { phase: 'Phase 3B', title: 'Adaptive Buffett band', done: true },
  { phase: 'Phase 4A', title: 'Dataset registry', done: true },
  { phase: 'Phase 4B', title: 'Layered multi-series chart', done: true },
  { phase: 'Phase 5A', title: 'Analysis engine and status labels', done: true },
  { phase: 'Phase 5B', title: 'Relationship engine (correlation, rolling, lead / lag)', done: true },
  { phase: 'Phase 5C', title: 'Scenario engine (trend, relationship, analogue)', done: true },
  { phase: 'Phase 5D', title: 'Pattern engine (environment matching)', done: true },
  { phase: 'Phase 6', title: 'Production polish and UX', done: true },
  { phase: 'Version 2', title: 'The advanced engines on screen', done: false },
  { phase: 'Version 3', title: 'Workspaces and custom data feeds', done: false },
] as const;
