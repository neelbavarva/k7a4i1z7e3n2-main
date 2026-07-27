export function calculateBuffettIndicator(marketCap: number | null, gdp: number | null) {
  if (marketCap === null || gdp === null || gdp === 0) return null;
  return (marketCap / gdp) * 100;
}
