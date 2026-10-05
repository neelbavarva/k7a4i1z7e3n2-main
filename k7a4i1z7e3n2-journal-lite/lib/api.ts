// The browser's side of the Kaizen Journal API.
// Reads go straight to the public API (or the in-memory sample journal with ?demo). Writes go to this site's own /api/kaizen proxy,
// which adds the private X-API-Key on the server; the key never reaches the browser.

import * as demo from './demo';
import { ApiError } from './errors';
import type { BlownWeek, CalendarMonth, Pagination, Trade, TradeDetail, TradeImage, TradeStatus, TradeType } from './types';

export { ApiError };
export const isDemo = demo.demoOn;

export const API_URL = (process.env.NEXT_PUBLIC_KAIZEN_API_URL || 'https://k7a4i1z7e3n2-journal.lovable.app/api/public/v1').replace(/\/$/, '');
const PROXY = '/api/kaizen';

/** A calm sentence for an error, never infrastructure details. */
export function friendly(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'UNAUTHORIZED':
        return 'The journal rejected this site’s write key. Check that KAIZEN_API_KEY is the same here and on the journal API.';
      case 'NOT_CONFIGURED':
        return 'Saving is switched off: this site has no KAIZEN_API_KEY yet.';
      case 'NOT_FOUND':
        return err.message || 'That item no longer exists. It may have been deleted.';
      case 'CONFLICT':
        return err.message || 'That can’t be done any more.';
      case 'PAYLOAD_TOO_LARGE':
        return 'That upload is too large. Each image can be 10 MB at most, five at a time.';
      case 'NETWORK':
        return 'The journal can’t be reached. Check your connection and try again.';
      case 'VALIDATION_ERROR':
        return validationText(err.details) || err.message || 'Some of that isn’t valid.';
      default:
        return err.message || 'Something went wrong. Try again in a moment.';
    }
  }
  return 'Something went wrong. Try again in a moment.';
}

function validationText(details: unknown): string | null {
  if (!Array.isArray(details) || !details.length) return null;
  const d = details[0] as { path?: unknown[]; message?: string };
  const field = Array.isArray(d.path) && d.path.length ? `${d.path.join('.')}: ` : '';
  return d.message ? `${field}${d.message}` : null;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store', ...init });
  } catch {
    throw new ApiError('NETWORK', 'The journal can’t be reached.', 0);
  }
  if (res.status === 204) return undefined as T;
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* empty or not JSON */
  }
  if (!res.ok) {
    const e = (body as { error?: { code?: string; message?: string; details?: unknown } })?.error;
    const code = e?.code || (res.status === 413 ? 'PAYLOAD_TOO_LARGE' : res.status === 409 ? 'CONFLICT' : 'HTTP_' + res.status);
    throw new ApiError(code, e?.message || '', res.status, e?.details);
  }
  return (body as { data: T }).data;
}

async function requestPage<T>(url: string): Promise<{ data: T; meta: Pagination }> {
  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store' });
  } catch {
    throw new ApiError('NETWORK', 'The journal can’t be reached.', 0);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const e = body?.error;
    throw new ApiError(e?.code || 'HTTP_' + res.status, e?.message || '', res.status, e?.details);
  }
  return body;
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

// ----- Reads (public, direct) -----

export type TradeQuery = { pair?: string; status?: TradeStatus; tradeType?: TradeType; from?: string; to?: string };

export function listTrades(q: TradeQuery & { cursor?: string; limit?: number } = {}) {
  if (demo.demoOn()) return demo.listTrades(q);
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== '') params.set(k, String(v));
  return requestPage<Trade[]>(`${API_URL}/trades?${params}`);
}

/** Every trade, newest first, a page at a time. `onPage` sees the list grow as pages arrive. */
export async function listAllTrades(onPage?: (sofar: Trade[], more: boolean) => void, signal?: AbortSignal) {
  const all: Trade[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 200; page++) {
    if (signal?.aborted) break;
    const { data, meta } = await listTrades({ limit: 100, cursor });
    all.push(...data);
    onPage?.([...all], meta.hasMore);
    if (!meta.hasMore || !meta.nextCursor) break;
    cursor = meta.nextCursor;
  }
  return all;
}

export const getTrade = (id: string) => (demo.demoOn() ? demo.getTrade(id) : request<TradeDetail>(`${API_URL}/trades/${encodeURIComponent(id)}`));

export function getCalendar(month: string, q: { pair?: string; tradeType?: TradeType } = {}) {
  if (demo.demoOn()) return demo.getCalendar(month, q);
  const params = new URLSearchParams({ month });
  if (q.pair) params.set('pair', q.pair);
  if (q.tradeType) params.set('tradeType', q.tradeType);
  return request<CalendarMonth>(`${API_URL}/calendar?${params}`);
}

export const listBlownWeeks = () => (demo.demoOn() ? demo.listBlownWeeks() : request<BlownWeek[]>(`${API_URL}/blown-weeks`));
export const health = () => request<{ status: string; version: string }>(`${API_URL}/health`);

// ----- Writes (through this site's server proxy) -----

export type NewTrade = { pair: string; riskRatio: number; tradeType: TradeType; description?: string | null; createdAt?: string };
export type TradePatch = Partial<
  Pick<Trade, 'status' | 'closedAt' | 'riskRatio' | 'description' | 'setForget' | 'isKing' | 'kingDescription' | 'sabotagedWinner'>
>;

export const createTrade = (body: NewTrade) => (demo.demoOn() ? demo.createTrade(body) : request<Trade>(`${PROXY}/trades`, json('POST', body)));
export const updateTrade = (id: string, patch: TradePatch) =>
  demo.demoOn() ? demo.updateTrade(id, patch) : request<Trade>(`${PROXY}/trades/${id}`, json('PATCH', patch));
export const deleteTrade = (id: string) => (demo.demoOn() ? demo.deleteTrade(id) : request<void>(`${PROXY}/trades/${id}`, json('DELETE')));

export function uploadImages(tradeId: string, files: { file: Blob; name: string }[]) {
  if (demo.demoOn()) return demo.uploadImages(tradeId, files);
  const form = new FormData();
  for (const f of files) {
    form.append('file', f.file, f.name);
    form.append('name', f.name);
  }
  return request<TradeImage[]>(`${PROXY}/trades/${tradeId}/images`, { method: 'POST', body: form });
}

export const renameImage = (id: string, name: string) =>
  demo.demoOn() ? demo.renameImage(id, name) : request<TradeImage>(`${PROXY}/images/${id}`, json('PATCH', { name }));
export const deleteImage = (id: string) => (demo.demoOn() ? demo.deleteImage(id) : request<void>(`${PROXY}/images/${id}`, json('DELETE')));

export const markBlownWeek = (weekStart: string, blownThrough: string) =>
  demo.demoOn() ? demo.markBlownWeek(weekStart, blownThrough) : request<BlownWeek>(`${PROXY}/blown-weeks/${weekStart}`, json('PUT', { blownThrough }));
export const undoBlownWeek = (weekStart: string) =>
  demo.demoOn() ? demo.undoBlownWeek(weekStart) : request<void>(`${PROXY}/blown-weeks/${weekStart}`, json('DELETE'));

export const cleanup = () =>
  demo.demoOn()
    ? demo.cleanup()
    : request<{ deletedTrades: number; deletedBlownWeeks: number; deletedImages: number }>(`${PROXY}/cleanup`, json('POST', { confirmation: 'DELETE ALL' }));
