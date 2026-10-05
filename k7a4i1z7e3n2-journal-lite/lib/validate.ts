// Input rules from the API contract. The forms use them for inline errors, and the
// server proxy runs them again before anything is sent with the write key.

import { isPace } from './pace';
import { isPair } from './pairs';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TEXT_MAX = 5000;
export const NAME_MAX = 200;
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const IMAGES_PER_UPLOAD = 5;

const STATUSES = ['OPEN', 'PROFIT', 'LOSS'];
const TYPES = ['NORMAL', 'DEMO', 'MISSED'];

/** New trades take a pair from the list in lib/pairs.ts. */
export function pairError(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return 'Pick a pair.';
  if (!isPair(v)) return 'Pick a pair from the list.';
  return null;
}

export function riskError(v: unknown): string | null {
  const n = typeof v === 'number' ? v : Number(v);
  if (v === '' || v == null || !Number.isFinite(n)) return 'Enter the R multiple, like 2.5.';
  if (n <= 0) return 'It has to be more than 0.';
  if (n > 100) return 'It can be 100 at most.';
  return null;
}

export function textError(v: unknown, label = 'Notes'): string | null {
  if (v == null) return null;
  if (typeof v !== 'string') return `${label} must be text.`;
  if (v.length > TEXT_MAX) return `${label} can be ${TEXT_MAX.toLocaleString()} characters at most.`;
  return null;
}

const isIsoDateTime = (v: unknown) => typeof v === 'string' && !Number.isNaN(Date.parse(v));
const isBool = (v: unknown) => typeof v === 'boolean';

type Body = Record<string, unknown>;
type Check = (body: Body) => string | null;

function only(body: Body, allowed: string[]): string | null {
  const extra = Object.keys(body).filter((k) => !allowed.includes(k));
  return extra.length ? `Unexpected field: ${extra.join(', ')}.` : null;
}

export const checkCreateTrade: Check = (b) =>
  only(b, ['pair', 'riskRatio', 'tradeType', 'description', 'createdAt']) ||
  pairError(b.pair) ||
  riskError(b.riskRatio) ||
  (b.tradeType !== undefined && !TYPES.includes(b.tradeType as string) ? 'Unknown trade type.' : null) ||
  textError(b.description) ||
  (b.createdAt !== undefined && !isIsoDateTime(b.createdAt) ? 'The date is not valid.' : null);

export const checkUpdateTrade: Check = (b) => {
  const keys = ['status', 'closedAt', 'riskRatio', 'description', 'setForget', 'isKing', 'kingDescription', 'sabotagedWinner'];
  if (!Object.keys(b).length) return 'Nothing to update.';
  return (
    only(b, keys) ||
    (b.status !== undefined && !STATUSES.includes(b.status as string) ? 'Unknown status.' : null) ||
    (b.closedAt !== undefined && b.closedAt !== null && !isIsoDateTime(b.closedAt) ? 'The close date is not valid.' : null) ||
    (b.riskRatio !== undefined ? riskError(b.riskRatio) : null) ||
    textError(b.description) ||
    // the King fields carry the pace now (see lib/pace.ts): nothing else goes in
    (b.kingDescription !== undefined && b.kingDescription !== null && !isPace(b.kingDescription) ? 'Pace must be RUSHING or DRAGGING.' : null) ||
    (['setForget', 'isKing', 'sabotagedWinner'].some((k) => b[k] !== undefined && !isBool(b[k])) ? 'Flags must be true or false.' : null)
  );
};

export const checkRename: Check = (b) =>
  only(b, ['name']) ||
  (typeof b.name !== 'string' || !b.name.trim() ? 'Give the image a name.' : null) ||
  ((b.name as string).length > NAME_MAX ? `Names can be ${NAME_MAX} characters at most.` : null);

export const checkBlownWeek: Check = (b) =>
  only(b, ['blownThrough']) || (typeof b.blownThrough !== 'string' || !DATE_RE.test(b.blownThrough) ? 'Pick a day.' : null);

