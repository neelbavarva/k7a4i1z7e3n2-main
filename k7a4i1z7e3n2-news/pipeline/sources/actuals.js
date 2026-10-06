import { ACTUALS } from '../config.js';
import { parseValue, unitOf } from '../lib/parse.js';
import { log, sleep } from '../lib/store.js';

const MIN = 60 * 1000;
const DAY = 86400 * 1000;

function setActual(e, raw, source, url = null) {
  e.actual = parseValue(raw);
  e.actualRaw = String(raw).trim();
  e.actualSource = source;
  e.actualSourceUrl = url;
}

/**
 * Source 1 (free, automatic): a recurring indicator's next listing carries the
 * previous release as "previous". That is the official (possibly revised) actual.
 */
export function fillFromFeedPrevious(store, nowMs) {
  const byKey = new Map();
  for (const e of Object.values(store)) {
    const k = `${e.currency}|${e.title}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(e);
  }
  let filled = 0;
  for (const list of byKey.values()) {
    list.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
    for (let i = 0; i < list.length - 1; i++) {
      const e = list[i];
      const next = list[i + 1];
      if (e.actualSource === 'manual' || e.actualSource === 'feed') continue;
      // Only trust it once the release is at least an hour old, so the feed has caught up.
      if (Date.parse(e.time) > nowMs - 60 * MIN) continue;
      if (next.previous == null || unitOf(next.previousRaw) !== unitOf(e.forecastRaw)) continue;
      setActual(e, next.previousRaw, 'feed');
      filled++;
    }
  }
  return filled;
}

/**
 * Source 2 (manual, highest priority): data/actuals_overrides.csv
 * columns: date (YYYY-MM-DD, UTC), currency, title, actual
 */
export function applyOverrides(store, csvText) {
  const rows = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
  if (!rows.length) return 0;
  const header = rows[0].toLowerCase().split(',').map((s) => s.trim());
  const idx = (name) => header.indexOf(name);
  let applied = 0;
  for (const line of rows.slice(1)) {
    const cols = splitCsv(line);
    const date = cols[idx('date')];
    const currency = cols[idx('currency')]?.toUpperCase();
    const title = cols[idx('title')]?.toLowerCase();
    const actual = cols[idx('actual')];
    if (!date || !currency || !title || !actual) continue;
    const match = Object.values(store).find(
      (e) => e.currency === currency && e.title.toLowerCase() === title && e.time.slice(0, 10) === date,
    );
    if (!match) {
      log(`overrides: no event matches "${line}"`);
      continue;
    }
    setActual(match, actual, 'manual');
    applied++;
  }
  return applied;
}

function splitCsv(line) {
  const out = [];
  let cur = '';
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

const matters = (e) => !e.skip && (e.impact === 'High' || e.impact === 'Medium');

/**
 * Events that still need an actual value and are worth an AI lookup: High/Medium
 * releases, plus anything a market's driver profile counts (isDriver), such as
 * weekly crude inventories or China's factory PMIs.
 */
export function needsLookup(store, nowMs, isDriver = () => false) {
  return Object.values(store)
    .filter((e) => {
      const t = Date.parse(e.time);
      return (
        (matters(e) || isDriver(e)) &&
        e.actual == null &&
        e.forecast != null &&
        (e.attempts ?? 0) < ACTUALS.maxAttempts &&
        t < nowMs - ACTUALS.minutesAfterRelease * MIN &&
        t > nowMs - ACTUALS.lookbackDays * DAY
      );
    })
    .sort((a, b) => (b.impact === 'High') - (a.impact === 'High') || Date.parse(b.time) - Date.parse(a.time));
}

/** Rejects answers that are clearly not the same kind of number as the forecast. */
export function plausible(e, raw) {
  const v = parseValue(raw);
  if (v == null) return false;
  if (unitOf(raw) !== unitOf(e.forecastRaw)) return false;
  const scale = Math.max(Math.abs(e.forecast), Math.abs(e.previous ?? 0), 1e-9);
  return Math.abs(v - e.forecast) <= 10 * scale + 1;
}

/**
 * Source 3 (automatic, needs GEMINI_API_KEY): asks Gemini with Google Search
 * grounding for the released value.
 */
export async function fillFromGemini(store, nowMs, { apiKey, model = ACTUALS.geminiModel, isDriver }) {
  const todo = needsLookup(store, nowMs, isDriver).slice(0, ACTUALS.maxPerRun);
  let filled = 0;
  let error = null;
  for (const [i, e] of todo.entries()) {
    if (i > 0) await sleep(ACTUALS.delayMs);
    try {
      const ans = await askGemini(e, { apiKey, model });
      // only an answer counts as a try; an outage or a retired model shouldn't use them up
      e.attempts = (e.attempts ?? 0) + 1;
      if (ans.found && ans.actual_raw && plausible(e, ans.actual_raw)) {
        setActual(e, ans.actual_raw, 'gemini', ans.source_url || null);
        filled++;
        log(`actuals: ${e.currency} ${e.title} = ${ans.actual_raw}`);
      } else {
        log(`actuals: no usable answer for ${e.currency} ${e.title} (attempt ${e.attempts})`);
      }
    } catch (err) {
      log(`actuals: Gemini error for ${e.currency} ${e.title}: ${err.message}`);
      error = err.message.split('\n')[0].slice(0, 160);
    }
  }
  return { tried: todo.length, filled, error, model: modelInUse ?? model };
}

// Google retires model versions; when it does, its 404 names the replacement ("use
// models/gemini-x-flash"), so follow that once and keep using it for the rest of the run.
let modelInUse = null;
async function callGemini(prompt, { apiKey, model }) {
  for (let hop = 0; hop < 2; hop++) {
    const m = modelInUse ?? model;
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0 },
      }),
    });
    if (res.ok) return res;
    const body = await res.text();
    const next = res.status === 404 && body.match(/use models\/([\w.-]+)/)?.[1];
    if (next && next !== m) {
      log(`actuals: Gemini model ${m} is retired; using ${next}`);
      modelInUse = next;
      continue;
    }
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  throw new Error('Gemini model lookup went round in circles');
}

async function askGemini(e, { apiKey, model }) {
  const prompt = [
    `Find the officially released ACTUAL value for the economic indicator "${e.title}" for currency ${e.currency},`,
    `released at ${e.time} (UTC). The consensus forecast was ${e.forecastRaw}${e.previousRaw ? ` and the previous value was ${e.previousRaw}` : ''}.`,
    'Reply with JSON only, no prose:',
    '{"found": true|false, "actual_raw": "value in the same format as the forecast, e.g. 0.3% or 150K", "source_url": "url"}',
    'If the value is not yet published or you are not sure, reply {"found": false}.',
  ].join(' ');
  const res = await callGemini(prompt, { apiKey, model });
  const data = await res.json();
  const cand = data.candidates?.[0];
  const text = (cand?.content?.parts ?? []).map((p) => p.text ?? '').join('');
  const json = text.match(/\{[\s\S]*\}/);
  if (!json) return { found: false };
  const ans = JSON.parse(json[0]);
  if (!ans.source_url) ans.source_url = cand?.groundingMetadata?.groundingChunks?.[0]?.web?.uri ?? null;
  return ans;
}
