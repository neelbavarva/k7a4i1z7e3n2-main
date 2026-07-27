export type CountryCode = string;

export type EconomicRecord = {
  country: CountryCode;
  year: number;
  gdp: number | null;
  realGdp: number | null;
  gdpGrowth: number | null;
  marketCap: number | null;
  marketCapToGdp: number | null;
  listedCompanies: number | null;
  buffettIndicator: number | null;
};

export type CountryDataset = { country: CountryCode; name: string; records: EconomicRecord[] };
export type EconomicsResponse = { countries: CountryDataset[]; fetchedAt: string };

export type AiCapitalFlowRecord = {
  country: CountryCode;
  year: number;
  /** Broad AI capital investment, only when the source reports it separately. */
  aiInvestment: number | null;
  /** Venture-capital investment into AI firms. Never inferred from aiInvestment. */
  aiVentureCapitalInvestment: number | null;
  aiInvestmentGrowth: number | null;
  aiShareOfTotalVc: number | null;
};

export type AiCapitalFlowDataset = { country: CountryCode; name: string; records: AiCapitalFlowRecord[] };
export type AiCapitalFlowResponse = {
  countries: AiCapitalFlowDataset[];
  fetchedAt: string;
  source: { name: string; url: string; frequency: 'annual'; latestObservationYear: number | null; availability: 'available' | 'unavailable' };
};

export type CryptoMarketCapRecord = {
  /** Calendar year; daily provider observations are reduced to the final available observation per year. */
  year: number;
  marketCap: number;
};

export type CryptoMarketCapResponse = {
  records: CryptoMarketCapRecord[];
  fetchedAt: string;
  source: { name: string; url: string; frequency: 'annual'; latestObservationYear: number | null; availability: 'available' | 'unavailable' };
};
