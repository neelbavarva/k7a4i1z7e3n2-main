// Position sizing (pure). The amount at risk divided by what the stop costs per lot:
//   lots = risk ÷ (stop in pips × pip value of one lot)
//   pip value of one lot = pip × units in a lot, in the quote currency, converted to the account's
// Lots are rounded down to the broker's lot step, so the trade never risks more than asked.

import { decimals } from './instruments';

export interface SizeInput {
  balance: number;
  riskMode: 'percent' | 'money';
  /** a percentage of the balance, or an amount in the account currency */
  risk: number;
  stopPips: number;
  /** one pip, in the quote currency */
  pip: number;
  /** units in one lot */
  lot: number;
  lotStep: number;
  /** one unit of the quote currency, in the account currency */
  quoteToAccount: number;
  /** the price (quote per base), if known: for position value and margin */
  price: number | null;
  leverage: number | null;
}

export interface Sizing {
  riskAmount: number;
  riskPercent: number;
  pipValuePerLot: number;
  exactLots: number;
  lots: number;
  units: number;
  pipValue: number;
  /** what the rounded position risks */
  actualRisk: number;
  actualPercent: number;
  /** what the smallest position (one lot step) risks */
  stepRisk: number;
  notional: number | null;
  margin: number | null;
}

/** Round down to a step, without float dust (0.49999… → 0.49, 0.5 stays 0.5). */
export function floorTo(v: number, step: number): number {
  const places = decimals(step);
  return Number((Math.floor(v / step + 1e-9) * step).toFixed(places));
}

export function sizePosition(i: SizeInput): Sizing {
  const riskAmount = i.riskMode === 'percent' ? (i.balance * i.risk) / 100 : i.risk;
  const pipValuePerLot = i.pip * i.lot * i.quoteToAccount;
  const perLot = i.stopPips * pipValuePerLot;
  const exactLots = perLot > 0 ? riskAmount / perLot : 0;
  const lots = floorTo(exactLots, i.lotStep);
  const units = lots * i.lot;
  const actualRisk = lots * perLot;
  const notional = i.price ? units * i.price * i.quoteToAccount : null;
  return {
    riskAmount,
    riskPercent: i.balance > 0 ? (riskAmount / i.balance) * 100 : 0,
    pipValuePerLot,
    exactLots,
    lots,
    units,
    pipValue: lots * pipValuePerLot,
    actualRisk,
    actualPercent: i.balance > 0 ? (actualRisk / i.balance) * 100 : 0,
    stepRisk: i.lotStep * perLot,
    notional,
    margin: notional !== null && i.leverage ? notional / i.leverage : null,
  };
}

/** A number typed by a person: "10,000", " 1.5 ", "0,5" (a lone comma is a decimal point). */
export function parseNum(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  let s = raw.trim().replace(/[\s_']/g, '');
  if (!s) return null;
  if (/^\d*,\d+$/.test(s) && !/^\d{1,3},\d{3}$/.test(s)) s = s.replace(',', '.');
  s = s.replace(/,/g, '');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
