import { RESEARCH_MARKETS } from '@/lib/worldbank/client';

/** Countries get a round flag; World and the regional aggregates get a lettered badge. */
export const COUNTRY_CODES = new Set(['US', 'IN', 'CN', 'RU', 'JP', 'GB']);
export const isCountry = (code: string) => COUNTRY_CODES.has(code);

/**
 * One colour per market, used everywhere a market appears (chart lines, legend,
 * rows, picker). Tuned to sit on the off-white page next to the FX blue/red.
 */
const MARKET_COLORS: Record<string, string> = {
  US: '#2a78d6',
  IN: '#d9731c',
  CN: '#c8414f',
  RU: '#7b55b8',
  JP: '#b0477f',
  GB: '#14808f',
  WLD: '#3d443d',
  Z7E: '#4f68b0',
  Z4E: '#2c8a63',
  SAS: '#6f8f2e',
  LCN: '#9a5e9d',
  MEA: '#a26a00',
  SSF: '#8c5d3b',
};
export const PALETTE = ['#2a78d6', '#d9731c', '#2c8a63', '#7b55b8', '#c8414f', '#14808f', '#a26a00', '#b0477f'];
export const colorFor = (code: string, index = 0) => MARKET_COLORS[code] ?? PALETTE[index % PALETTE.length];

export const marketName = (code: string) => RESEARCH_MARKETS.find(([id]) => id === code)?.[1] ?? code;

/** Short label shown inside a region's round badge. */
export const REGION_BADGE: Record<string, string> = {
  Z7E: 'ECA',
  Z4E: 'EAP',
  SAS: 'SA',
  LCN: 'LAC',
  MEA: 'MNA',
  SSF: 'SSA',
};

/** Search aliases for the market picker. */
export const MARKET_ALIASES: Record<string, string[]> = {
  US: ['usa', 'america', 'united states', 'us'],
  IN: ['india', 'in', 'bharat'],
  CN: ['china', 'cn', 'prc'],
  RU: ['russia', 'ru'],
  JP: ['japan', 'jp'],
  GB: ['uk', 'britain', 'united kingdom', 'england', 'gb'],
  WLD: ['world', 'global', 'all'],
  Z7E: ['europe', 'central asia', 'eca', 'eu'],
  Z4E: ['east asia', 'pacific', 'eap', 'asia'],
  SAS: ['south asia', 'sa', 'asia'],
  LCN: ['latin america', 'caribbean', 'lac', 'latam'],
  MEA: ['middle east', 'north africa', 'mena', 'africa'],
  SSF: ['sub-saharan', 'africa', 'ssa'],
};
