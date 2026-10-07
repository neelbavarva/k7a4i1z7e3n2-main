// Which official series gives each release's number (pipeline/sources/official.js reads them).
// Plain data with no Node imports, so "How the score works" can list it too.

// how each release's number is worked out from its series:
//   level: the latest value · pct: % change on the period before · yoy: % change on a year before
//   diff: the change on the period before
// scale turns the series' unit into a plain number (thousands -> 1e3), so the value can be written
// in the calendar's own unit.
const S = (agency, id, calc, scale = 1, extra = {}) => ({ agency, id, calc, scale, ...extra });
export const OFFICIAL = {
  // United States, through FRED (the St. Louis Fed's copy of BLS, BEA and Census releases)
  'USD|Non-Farm Employment Change': S('fred', 'PAYEMS', 'diff', 1e3),
  'USD|Unemployment Rate': S('fred', 'UNRATE', 'level'),
  'USD|Average Hourly Earnings m/m': S('fred', 'CES0500000003', 'pct'),
  'USD|CPI m/m': S('fred', 'CPIAUCSL', 'pct'),
  'USD|CPI y/y': S('fred', 'CPIAUCNS', 'yoy'),
  'USD|Core CPI m/m': S('fred', 'CPILFESL', 'pct'),
  'USD|Core CPI y/y': S('fred', 'CPILFENS', 'yoy'),
  'USD|PPI m/m': S('fred', 'PPIFIS', 'pct'),
  'USD|Core PPI m/m': S('fred', 'PPIFES', 'pct'),
  'USD|Retail Sales m/m': S('fred', 'RSAFS', 'pct'),
  'USD|Core Retail Sales m/m': S('fred', 'RSFSXMV', 'pct'),
  'USD|Unemployment Claims': S('fred', 'ICSA', 'level'),
  'USD|Core PCE Price Index m/m': S('fred', 'PCEPILFE', 'pct'),
  'USD|Core PCE Price Index y/y': S('fred', 'PCEPILFE', 'yoy'),
  'USD|Advance GDP q/q': S('fred', 'A191RL1Q225SBR', 'level'),
  'USD|Prelim GDP q/q': S('fred', 'A191RL1Q225SBR', 'level'),
  'USD|Final GDP q/q': S('fred', 'A191RL1Q225SBR', 'level'),
  'USD|Industrial Production m/m': S('fred', 'INDPRO', 'pct'),
  'USD|Durable Goods Orders m/m': S('fred', 'DGORDER', 'pct'),
  'USD|Core Durable Goods Orders m/m': S('fred', 'ADXTNO', 'pct'),
  'USD|Building Permits': S('fred', 'PERMIT', 'level', 1e3),
  'USD|Housing Starts': S('fred', 'HOUST', 'level', 1e3),
  'USD|JOLTS Job Openings': S('fred', 'JTSJOL', 'level', 1e3),
  'USD|Trade Balance': S('fred', 'BOPGSTB', 'level', 1e6),
  // Canada, Statistics Canada (vector ids)
  'CAD|Employment Change': S('statcan', 2062811, 'diff', 1e3),
  'CAD|Unemployment Rate': S('statcan', 2062815, 'level'),
  'CAD|CPI m/m': S('statcan', 41690973, 'pct'),
  'CAD|CPI y/y': S('statcan', 41690973, 'yoy'),
  'CAD|GDP m/m': S('statcan', 65201210, 'pct'),
  'CAD|Retail Sales m/m': S('statcan', 1446859483, 'pct'),
  // core retail: all retail less motor vehicle and parts dealers
  'CAD|Core Retail Sales m/m': S('statcan', 1446859483, 'pct', 1, { minus: 1446859486 }),
  'CAD|Trade Balance': S('statcan', 87008984, 'level', 1e6),
  'CAD|Manufacturing Sales m/m': S('statcan', 800450, 'pct'),
  // United Kingdom, ONS (series id / dataset, under its topic path)
  'GBP|CPI y/y': S('ons', 'economy/inflationandpriceindices/timeseries/d7g7/mm23', 'level'),
  'GBP|CPI m/m': S('ons', 'economy/inflationandpriceindices/timeseries/d7oe/mm23', 'level'),
  'GBP|Core CPI y/y': S('ons', 'economy/inflationandpriceindices/timeseries/dko8/mm23', 'level'),
  'GBP|Unemployment Rate': S('ons', 'employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/mgsx/lms', 'level'),
  'GBP|Average Earnings Index 3m/y': S('ons', 'employmentandlabourmarket/peopleinwork/earningsandworkinghours/timeseries/kac3/lms', 'level'),
  'GBP|GDP m/m': S('ons', 'economy/grossdomesticproductgdp/timeseries/ecy2/mgdp', 'pct'),
  'GBP|Prelim GDP q/q': S('ons', 'economy/grossdomesticproductgdp/timeseries/ihyq/qna', 'level'),
  'GBP|Final GDP q/q': S('ons', 'economy/grossdomesticproductgdp/timeseries/ihyq/qna', 'level'),
  'GBP|Retail Sales m/m': S('ons', 'businessindustryandtrade/retailindustry/timeseries/j5ek/drsi', 'pct'),
  // Australia, ABS (dataflow/key); "lag" is how far before the release month its period ends
  'AUD|Employment Change': S('abs', 'LF/M3.3.1599.20.AUS.M', 'diff', 1e3, { freq: 'M' }),
  'AUD|Unemployment Rate': S('abs', 'LF/M13.3.1599.20.AUS.M', 'level', 1, { freq: 'M' }),
  'AUD|CPI m/m': S('abs', 'CPI/2.10001.10.50.M', 'level', 1, { freq: 'M' }),
  'AUD|CPI y/y': S('abs', 'CPI/3.10001.10.50.M', 'level', 1, { freq: 'M' }),
  'AUD|Trimmed Mean CPI m/m': S('abs', 'CPI/2.999902.20.50.M', 'level', 1, { freq: 'M' }),
  'AUD|CPI q/q': S('abs', 'CPI/2.10001.10.50.Q', 'level', 1, { freq: 'Q' }),
  'AUD|GDP q/q': S('abs', 'ANA_AGG/M1.GPM.20.AUS.Q', 'pct', 1, { freq: 'Q' }),
};

export const AGENCY = {
  fred: { name: 'FRED (BLS, BEA, Census)', url: (id) => `https://fred.stlouisfed.org/series/${id}` },
  statcan: { name: 'Statistics Canada', url: (id) => `https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?vectorId=${id}` },
  ons: { name: 'ONS', url: (id) => `https://www.ons.gov.uk/${id}` },
  abs: { name: 'ABS', url: () => 'https://www.abs.gov.au/statistics' },
};
