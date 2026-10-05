interface InsightBannerProps {
  selectedModes: Set<string>;
  aiSourceName?: string;
  aiSourceUrl?: string;
  aiLatestYear?: number | null;
}

/** The "how to read this" note under the chart, led by an info mark. */
export function InsightBanner({ selectedModes, aiSourceName, aiSourceUrl, aiLatestYear }: InsightBannerProps) {
  if (selectedModes.has('buffett')) {
    return (
      <p>
        <b>Reading the band.</b> The shaded band is each market’s rolling 10-year Buffett average, plus or minus two standard
        deviations; the dashed line inside it is that average. The 100% line is a reference, not a fair-value target. A line
        outside its own band means market value and GDP are unusually far apart for that market’s history.
      </p>
    );
  }
  if (selectedModes.has('ai-capital')) {
    return (
      <p>
        <b>AI capital intensity.</b> Reported AI venture capital divided by GDP, so a rise means AI funding is growing faster than
        the economy. Points are observed annual values; the dashed line is a 5-year baseline. It doesn’t claim AI funding moves
        valuations. Source:{' '}
        <a href={aiSourceUrl ?? 'https://oecd.ai/en/data'} target="_blank" rel="noreferrer">
          {aiSourceName ?? 'OECD.AI'}
        </a>
        {aiLatestYear ? `, latest observation ${aiLatestYear}` : ''}.
      </p>
    );
  }
  if (selectedModes.has('valuation')) {
    return (
      <p>
        <b>Reading the scatter.</b> Each dot is one year for one market: across is real GDP growth, up is the Buffett indicator.
        Dots high and to the left are years when stock-market value ran ahead of the economy’s growth.
      </p>
    );
  }
  if (selectedModes.has('bubbles')) {
    return (
      <p>
        <b>Reading the bubble library.</b> Each episode is scaled to its own peak = 100 and lined up on the year it peaked, so
        the run-ups and falls compare directly; the levels don’t share a valuation measure. Lines join the published
        observations, so they show the shape, not every year. These are fixed historical references; they don’t follow the
        markets or range you pick.
      </p>
    );
  }
  return (
    <p>
      <b>How to read this.</b> Every selected market is on the same yearly timeline. Hover for exact values, drag to move
      through time, and pinch or hold ⌘/Ctrl and scroll to zoom; Reset puts the view back.
    </p>
  );
}
