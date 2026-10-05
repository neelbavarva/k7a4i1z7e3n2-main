// Sample-data mode (open the site with ?demo). A few months of made-up trades, screenshots and
// blown weeks, generated around today, with an in-memory stand-in for every API call: reads,
// writes and uploads all work, but nothing leaves the browser tab and a reload starts fresh. It
// follows the same rules as the real API (see /api/openapi.json).

import { ApiError } from './errors';
import type { BlownWeek, CalendarMonth, Pagination, Trade, TradeDetail, TradeImage, TradeStatus, TradeType } from './types';

export const demoOn = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('demo');

// ----- deterministic randomness, so the same day gives the same journal -----

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PAIRS: [string, number][] = [
  ['EURUSD', 18], ['GBPUSD', 12], ['XAUUSD', 11], ['USDJPY', 9], ['GBPJPY', 8], ['AUDUSD', 7],
  ['EURJPY', 6], ['USDCAD', 6], ['EURGBP', 4], ['NZDUSD', 4], ['USDCHF', 3], ['AUDJPY', 3], ['GBPAUD', 2], ['EURAUD', 2],
];

const NOTES = [
  'London breakout above the Asian high, stop under the range.',
  'Trend continuation on the 4H after a clean pullback to the 21 EMA.',
  'Fade of the NFP spike into the daily level.',
  'Double bottom on the 1H at weekly support, entry on the neckline retest.',
  'New York open sweep of yesterday’s low, then a reclaim.',
  'Range trade between Monday’s high and low.',
  'Break and retest of the descending trendline.',
  'CPI came in hot; rode the dollar strength.',
  'Supply zone rejection on the daily, tight stop above the wick.',
  'Asian session drift, small size. Not my best setup.',
  'Took it early: no confirmation candle. Lesson noted.',
  'Followed the plan to the letter. Target at the previous swing high.',
  'Moved the stop to break-even too soon and got wicked out.',
  'Correlated with the EURUSD position, so half risk.',
  'Waited three hours for the retest. Worth it.',
  null,
  null,
  null,
];

const LOSS_REVIEW = ['Closed it manually before the stop, then it ran to target.', 'Took profit at 1R out of fear; it hit the full target an hour later.'];

const pad = (n: number) => String(n).padStart(2, '0');
const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const mondayOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7));
const uuid = (n: number) => `0de00000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** A chart-like screenshot as an SVG data URL. */
function chartShot(label: string, seed: number, up: boolean) {
  const r = rng(seed);
  let y = 520;
  const pts: string[] = [];
  const candles: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const x = 40 + i * 38;
    const move = (r() - (up ? 0.42 : 0.58)) * 70;
    const open = y;
    y = Math.max(140, Math.min(800, y - move));
    const hi = Math.min(open, y) - r() * 30;
    const lo = Math.max(open, y) + r() * 30;
    const green = y < open;
    candles.push(
      `<line x1="${x}" x2="${x}" y1="${hi.toFixed(0)}" y2="${lo.toFixed(0)}" stroke="${green ? '#26a69a' : '#ef5350'}" stroke-width="2"/>` +
        `<rect x="${x - 11}" y="${Math.min(open, y).toFixed(0)}" width="22" height="${Math.max(3, Math.abs(open - y)).toFixed(0)}" fill="${green ? '#26a69a' : '#ef5350'}"/>`,
    );
    pts.push(`${x},${y.toFixed(0)}`);
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">` +
    `<rect width="1600" height="900" fill="#131722"/>` +
    Array.from({ length: 8 }, (_, i) => `<line x1="0" x2="1600" y1="${100 + i * 100}" y2="${100 + i * 100}" stroke="#1e2330"/>`).join('') +
    candles.join('') +
    `<polyline points="${pts.join(' ')}" fill="none" stroke="#2a78d6" stroke-width="3" opacity=".55"/>` +
    `<text x="48" y="78" fill="#d1d4dc" font-family="system-ui,sans-serif" font-size="40" font-weight="600">${label}</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// ----- the sample journal -----

type Store = { trades: Trade[]; images: Map<string, TradeImage[]>; blown: BlownWeek[]; seq: number };

function build(): Store {
  const now = new Date();
  const r = rng(Number(localDay(now).replace(/-/g, '')));
  const pick = <T,>(list: T[]) => list[Math.floor(r() * list.length)];
  const weighted = () => {
    const total = PAIRS.reduce((s, [, w]) => s + w, 0);
    let x = r() * total;
    for (const [p, w] of PAIRS) if ((x -= w) < 0) return p;
    return PAIRS[0][0];
  };

  const trades: Trade[] = [];
  const images = new Map<string, TradeImage[]>();
  let seq = 0;

  // about four months of weekdays, 0–3 trades a day, newest days a little busier
  for (let back = 120; back >= 0; back--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    const dow = day.getDay();
    if (dow === 0 || dow === 6) continue;
    const c = r();
    const count = c < 0.12 ? 0 : c < 0.38 ? 1 : c < 0.72 ? 2 : c < 0.92 ? 3 : 4;
    for (let k = 0; k < count; k++) {
      const hour = 7 + Math.floor(r() * 10);
      const created = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, Math.floor(r() * 60));
      if (created > now) continue;
      const roll = r();
      const tradeType: TradeType = roll < 0.7 ? 'NORMAL' : roll < 0.88 ? 'DEMO' : 'MISSED';
      const riskRatio = +(1 + Math.round(r() * 10) / 4).toFixed(2); // 1 to 3.5 in quarter steps
      const status: TradeStatus = tradeType === 'MISSED' ? 'PROFIT' : r() < 0.34 ? 'PROFIT' : 'LOSS';
      const closed = new Date(Math.min(now.getTime() - 60000, created.getTime() + (1 + r() * 30) * 3600000));
      const decided = tradeType === 'MISSED' || r() < 0.75;
      // pace, in the King fields (lib/pace.ts): rushed trades lose more often than the rest
      const p = r();
      const pace = p < (status === 'LOSS' ? 0.3 : 0.12) ? 'RUSHING' : p > 0.88 ? 'DRAGGING' : null;
      const sabotaged = status === 'LOSS' && tradeType === 'NORMAL' && r() < 0.18;
      const id = uuid(++seq);
      const note = sabotaged ? pick(LOSS_REVIEW) : pick(NOTES);
      trades.push({
        id,
        pair: weighted(),
        riskRatio,
        status,
        tradeType,
        setForget: tradeType === 'MISSED' ? true : decided && r() < 0.65,
        setForgetDecided: decided,
        description: note,
        isKing: !!pace,
        kingDescription: pace,
        sabotagedWinner: sabotaged,
        createdAt: created.toISOString(),
        closedAt: closed.toISOString(),
      });
      if (note && r() < 0.55) {
        const t = trades[trades.length - 1];
        const names = ['Before entry', 'Entry', 'After close', '4H context', '15m trigger'];
        const n = 1 + Math.floor(r() * 3);
        images.set(
          id,
          Array.from({ length: n }, (_, i) => ({
            id: uuid(10000 + seq * 10 + i),
            tradeId: id,
            name: names[i],
            position: i,
            createdAt: t.createdAt,
            url: chartShot(`${t.pair} · ${names[i]}`, seq * 10 + i, t.status !== 'LOSS'),
          })),
        );
      }
    }
  }
  trades.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  // the newest few real and demo trades are still running
  for (const t of trades.filter((x) => x.tradeType !== 'MISSED').slice(0, 4)) {
    t.status = 'OPEN';
    t.closedAt = null;
    t.setForgetDecided = false;
    t.setForget = false;
    t.sabotagedWinner = false;
    if (t.description && LOSS_REVIEW.includes(t.description)) t.description = 'Waiting on the London close; stop and target are set.';
  }

  // two blown weeks: one old (past its undo window), one recent (still undoable)
  const lastWeek = mondayOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7));
  const older = mondayOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 35));
  const at = (d: Date) => d.toISOString();
  const blown: BlownWeek[] = [
    { week_start: localDay(lastWeek), blown_through: localDay(new Date(lastWeek.getTime() + 3 * 86400000)), created_at: at(new Date(now.getTime() - 3 * 3600000)), updated_at: at(new Date(now.getTime() - 3 * 3600000)) },
    { week_start: localDay(older), blown_through: localDay(new Date(older.getTime() + 4 * 86400000)), created_at: at(older), updated_at: at(older) },
  ];

  return { trades, images, blown, seq: 50000 };
}

let store: Store | null = null;
const db = () => (store ||= build());

const wait = (ms = 220 + Math.random() * 260) => new Promise((res) => setTimeout(res, ms));
const clone = <T,>(v: T): T => structuredClone(v);

const DemoError = ApiError;

const find = (id: string) => {
  const t = db().trades.find((x) => x.id === id);
  if (!t) throw new DemoError('NOT_FOUND', 'Trade not found.', 404);
  return t;
};

const rOf = (t: Trade) => (t.status === 'PROFIT' ? t.riskRatio : t.status === 'LOSS' ? -1 : 0);
const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ----- reads -----

export async function listTrades(q: { pair?: string; status?: TradeStatus; tradeType?: TradeType; from?: string; to?: string; cursor?: string; limit?: number }) {
  await wait();
  const limit = Math.min(100, Math.max(1, q.limit || 50));
  let list = db().trades.filter(
    (t) =>
      (!q.pair || t.pair.includes(q.pair.toUpperCase())) &&
      (!q.status || t.status === q.status) &&
      (!q.tradeType || t.tradeType === q.tradeType) &&
      (!q.from || t.createdAt >= q.from) &&
      (!q.to || t.createdAt <= q.to),
  );
  if (q.cursor) list = list.filter((t) => t.createdAt < q.cursor!);
  // smaller pages than the real API, so the incremental loading state shows
  const page = list.slice(0, Math.min(limit, 60));
  const hasMore = list.length > page.length;
  const meta: Pagination = { limit, hasMore, nextCursor: hasMore ? page[page.length - 1].createdAt : null };
  return { data: clone(page), meta };
}

export async function getTrade(id: string): Promise<TradeDetail> {
  await wait();
  return clone({ ...find(id), images: db().images.get(id) || [] });
}

export async function getCalendar(month: string, q: { pair?: string; tradeType?: TradeType }): Promise<CalendarMonth> {
  await wait();
  const list = db().trades.filter(
    (t) => localDay(new Date(t.createdAt)).startsWith(month) && (!q.pair || t.pair === q.pair) && (!q.tradeType || t.tradeType === q.tradeType),
  );
  const days = new Map<string, { date: string; trades: Trade[]; r: number }>();
  for (const t of [...list].reverse()) {
    const k = localDay(new Date(t.createdAt));
    const d = days.get(k) || { date: k, trades: [], r: 0 };
    d.trades.push(t);
    d.r += rOf(t);
    days.set(k, d);
  }
  const group = (key: (t: Trade) => string, label: string) => {
    const m = new Map<string, { r: number; trades: number }>();
    for (const t of list.filter((x) => x.status !== 'OPEN')) {
      const g = m.get(key(t)) || { r: 0, trades: 0 };
      g.r += rOf(t);
      g.trades++;
      m.set(key(t), g);
    }
    const rows = [...m.entries()].map(([k, v]) => ({ [label]: k, r: +v.r.toFixed(2), trades: v.trades }));
    rows.sort((a, b) => (b.r as number) - (a.r as number));
    return { best: rows[0] || null, worst: rows.length > 1 ? rows[rows.length - 1] : null };
  };
  const wins = list.filter((t) => t.status === 'PROFIT').length;
  const losses = list.filter((t) => t.status === 'LOSS').length;
  const r = list.reduce((s, t) => s + rOf(t), 0);
  return clone({
    month,
    days: [...days.values()].sort((a, b) => (a.date < b.date ? -1 : 1)),
    summary: {
      closed: wins + losses,
      wins,
      losses,
      open: list.length - wins - losses,
      winRate: wins + losses ? wins / (wins + losses) : 0,
      r: +r.toFixed(2),
      percent: +(r * 100).toFixed(0),
      weeks: group((t) => localDay(mondayOf(new Date(t.createdAt))), 'weekStart'),
      pairs: group((t) => t.pair, 'pair'),
      weekdays: group((t) => WEEKDAY_NAMES[new Date(t.createdAt).getDay()], 'weekday'),
    },
  });
}

export async function listBlownWeeks() {
  await wait(150);
  return clone([...db().blown].sort((a, b) => (a.week_start < b.week_start ? 1 : -1)));
}

// ----- writes -----

export async function createTrade(body: { pair: string; riskRatio: number; tradeType?: TradeType; description?: string | null; createdAt?: string }) {
  await wait();
  const s = db();
  const missed = body.tradeType === 'MISSED';
  const t: Trade = {
    id: uuid(++s.seq),
    pair: body.pair.toUpperCase(),
    riskRatio: body.riskRatio,
    status: missed ? 'PROFIT' : 'OPEN',
    tradeType: body.tradeType || 'NORMAL',
    setForget: missed,
    setForgetDecided: missed,
    description: body.description ?? null,
    isKing: false,
    kingDescription: null,
    sabotagedWinner: false,
    createdAt: body.createdAt || new Date().toISOString(),
    closedAt: missed ? body.createdAt || new Date().toISOString() : null,
  };
  s.trades.unshift(t);
  s.trades.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return clone(t);
}

export async function updateTrade(id: string, patch: Partial<Trade>) {
  await wait();
  const t = find(id);
  if (patch.status && patch.status !== t.status) t.closedAt = patch.status === 'OPEN' ? null : new Date().toISOString();
  if ('closedAt' in patch) t.closedAt = patch.closedAt ?? null;
  if (patch.status) t.status = patch.status;
  if (patch.riskRatio !== undefined) t.riskRatio = patch.riskRatio;
  if ('description' in patch) t.description = patch.description ?? null;
  if (patch.setForget !== undefined) {
    t.setForget = patch.setForget;
    t.setForgetDecided = true;
  }
  if (patch.isKing !== undefined) {
    t.isKing = patch.isKing;
    if (!patch.isKing) t.kingDescription = null;
  }
  if ('kingDescription' in patch) t.kingDescription = patch.kingDescription ?? null;
  if (patch.sabotagedWinner !== undefined) t.sabotagedWinner = patch.sabotagedWinner;
  return clone(t);
}

export async function deleteTrade(id: string) {
  await wait();
  find(id);
  const s = db();
  s.trades = s.trades.filter((t) => t.id !== id);
  s.images.delete(id);
}

export async function uploadImages(tradeId: string, files: { file: Blob; name: string }[]) {
  await wait(500);
  find(tradeId);
  const s = db();
  const list = s.images.get(tradeId) || [];
  const added = files.map((f, i) => ({
    id: uuid(++s.seq),
    tradeId,
    name: f.name,
    position: list.length + i,
    createdAt: new Date().toISOString(),
    url: URL.createObjectURL(f.file),
  }));
  s.images.set(tradeId, [...list, ...added]);
  return clone(added);
}

function findImage(id: string) {
  for (const [tradeId, list] of db().images) {
    const img = list.find((x) => x.id === id);
    if (img) return { tradeId, list, img };
  }
  throw new DemoError('NOT_FOUND', 'Image not found.', 404);
}

export async function renameImage(id: string, name: string) {
  await wait();
  const { img } = findImage(id);
  img.name = name;
  return clone(img);
}

export async function deleteImage(id: string) {
  await wait();
  const { tradeId, list } = findImage(id);
  db().images.set(tradeId, list.filter((x) => x.id !== id));
}

export async function markBlownWeek(weekStart: string, blownThrough: string) {
  await wait();
  const start = new Date(weekStart + 'T00:00:00');
  const end = new Date(start.getTime() + 6 * 86400000);
  const through = new Date(blownThrough + 'T00:00:00');
  if (start.getDay() !== 1 || through < start || through > end) throw new DemoError('VALIDATION_ERROR', 'Pick a day inside that Monday–Sunday week.', 400);
  const s = db();
  const at = new Date().toISOString();
  const existing = s.blown.find((b) => b.week_start === weekStart);
  const rec: BlownWeek = { week_start: weekStart, blown_through: blownThrough, created_at: existing?.created_at || at, updated_at: at };
  s.blown = [rec, ...s.blown.filter((b) => b.week_start !== weekStart)];
  return clone(rec);
}

export async function undoBlownWeek(weekStart: string) {
  await wait();
  const s = db();
  const rec = s.blown.find((b) => b.week_start === weekStart);
  if (!rec) throw new DemoError('NOT_FOUND', 'That week isn’t marked blown.', 404);
  if (Date.now() - Date.parse(rec.updated_at) > 24 * 3600000) throw new DemoError('CONFLICT', 'The 24-hour undo window has passed.', 409);
  s.blown = s.blown.filter((b) => b.week_start !== weekStart);
}

