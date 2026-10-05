// Shapes returned by the Kaizen Journal API (see /api/openapi.json).

export type TradeStatus = 'OPEN' | 'PROFIT' | 'LOSS';
export type TradeType = 'NORMAL' | 'DEMO' | 'MISSED';

export type Trade = {
  id: string;
  pair: string;
  riskRatio: number;
  status: TradeStatus;
  tradeType: TradeType;
  setForget: boolean;
  setForgetDecided: boolean;
  description: string | null;
  isKing: boolean;
  kingDescription: string | null;
  sabotagedWinner: boolean;
  createdAt: string;
  closedAt: string | null;
};

export type TradeImage = {
  id: string;
  tradeId: string;
  name: string;
  position: number;
  createdAt: string;
  url: string;
};

export type TradeDetail = Trade & { images: TradeImage[] };

export type Pagination = { limit: number; hasMore: boolean; nextCursor: string | null };

export type CalendarDay = { date: string; trades: Trade[]; r: number };

/** Best/worst entries are computed by the API; their exact keys may vary, so they stay loose. */
export type Ranked = Record<string, unknown> | null;

export type CalendarSummary = {
  closed: number;
  wins: number;
  losses: number;
  open: number;
  winRate: number;
  r: number;
  percent: number;
  weeks: { best: Ranked; worst: Ranked };
  pairs: { best: Ranked; worst: Ranked };
  weekdays: { best: Ranked; worst: Ranked };
};

export type CalendarMonth = { month: string; days: CalendarDay[]; summary: CalendarSummary };

export type BlownWeek = {
  week_start: string;
  blown_through: string;
  created_at: string;
  updated_at: string;
};

export type ApiErrorBody = { error: { code: string; message: string; details?: unknown } };
