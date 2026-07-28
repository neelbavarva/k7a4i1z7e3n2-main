interface InsightBannerProps {
  selectedModes: Set<string>;
  aiSourceName?: string;
  aiSourceUrl?: string;
  aiLatestYear?: number | null;
}

export function InsightBanner({
  selectedModes,
  aiSourceName,
  aiSourceUrl,
  aiLatestYear,
}: InsightBannerProps) {
  return (
    <section
      className="mb-3 rounded-lg p-3.5 text-xs leading-relaxed sm:text-[11.5px] sm:leading-5"
      style={{
        border: '1px solid rgba(99, 102, 241, 0.15)',
        background: 'rgba(99, 102, 241, 0.04)',
        color: 'var(--text-secondary)',
      }}
      aria-label="Chart reading guide"
    >
      {selectedModes.has('buffett') ? (
        <p>
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Reading flow equilibrium:</span> the visible
          band is each market&rsquo;s rolling 10-year Buffett average ±&thinsp;two standard deviations—a
          broader historical envelope—while its dashed centre line is the adaptive baseline. The 100%
          line is a reference centre only, not a universal fair-value target. A line outside its own
          band signals an unusually large market-cap/GDP gap versus that market&rsquo;s history.
        </p>
      ) : selectedModes.has('ai-capital') ? (
        <p>
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>AI capital intensity:</span> the default view
          normalizes reported AI VC by GDP, so a rise means AI-directed venture funding is becoming
          larger relative to the economy. Compare it with Buffett separately for context—this view does
          not claim that AI funding causes market valuations. Points are observed annual values; the
          dashed line is a 5-year baseline. Source:{' '}
          <a
            className="underline underline-offset-2 break-all text-indigo-600 font-medium"
            href={aiSourceUrl ?? 'https://oecd.ai/en/data'}
            target="_blank"
            rel="noreferrer"
          >
            {aiSourceName ?? 'OECD.AI'}
          </a>
          {aiLatestYear ? ` · latest observation ${aiLatestYear}` : ''}.
        </p>
      ) : selectedModes.has('bubbles') ? (
        <p>
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Reading the bubble library:</span> each plotted
          benchmark is independently normalized to its own published peak&thinsp;=&thinsp;100, so its
          path is comparable but its level is not a shared valuation measure. The library is static,
          source-backed historical reference data and does not respond to the selected markets or
          timeframe.
        </p>
      ) : (
        <p>
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>How to read this view:</span> compare the
          selected markets on the same timeline, use the tooltip for exact annual values, and scroll or
          drag directly on the chart to inspect a period.
        </p>
      )}
    </section>
  );
}
