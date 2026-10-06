/**
 * Session hours, the session-overlap volume model and the schematic AMD cycle.
 * Everything here is pure: it takes the UTC start of the viewer's selected day and returns
 * positions in hours (0–24) within that day. None of it is live market data.
 */
import { DAY_MS, HOUR_MS, clamp, shiftDate, zonedParts, zonedWallToUtc } from './marketTime';

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export type SessionId = 'sydney' | 'tokyo' | 'london' | 'newyork';

export interface SessionDef {
  id: SessionId;
  city: string;
  timeZone: string;
  /** local wall-clock hours */
  open: number;
  close: number;
  color: string;
  /** relative contribution to the volume model */
  weight: number;
}

export const SESSIONS: readonly SessionDef[] = [
  { id: 'sydney', city: 'Sydney', timeZone: 'Australia/Sydney', open: 8, close: 17, color: 'oklch(0.63 0.12 254)', weight: 0.5 },
  { id: 'tokyo', city: 'Tokyo', timeZone: 'Asia/Tokyo', open: 9, close: 18, color: 'oklch(0.66 0.12 285)', weight: 0.8 },
  { id: 'london', city: 'London', timeZone: 'Europe/London', open: 8, close: 17, color: 'oklch(0.61 0.13 165)', weight: 1.3 },
  { id: 'newyork', city: 'New York', timeZone: 'America/New_York', open: 8, close: 17, color: 'oklch(0.67 0.14 75)', weight: 1.25 },
];

/** A session or phase interval in hours from the selected day's start. raw* are unclipped. */
export interface Segment {
  start: number;
  end: number;
  rawStart: number;
  rawEnd: number;
}

const isWeekend = (weekday: number) => weekday === 0 || weekday === 6;

/** Where a session sits inside the selected day, checking the previous, current and next local days. */
export function sessionSegments(session: SessionDef, dayStart: number): Segment[] {
  const mid = zonedParts(session.timeZone, dayStart + DAY_MS / 2);
  const out: Segment[] = [];
  for (const k of [-1, 0, 1]) {
    const date = shiftDate(mid, k);
    if (isWeekend(date.weekday)) continue;
    const rawStart = (zonedWallToUtc(session.timeZone, date, session.open) - dayStart) / HOUR_MS;
    const rawEnd = (zonedWallToUtc(session.timeZone, date, session.close) - dayStart) / HOUR_MS;
    const start = clamp(rawStart, 0, 24);
    const end = clamp(rawEnd, 0, 24);
    if (end > start) out.push({ start, end, rawStart, rawEnd });
  }
  return out;
}

/** True when real time `at` is within the session on its own local calendar (weekdays only). */
export function isSessionOpen(session: SessionDef, at: number): boolean {
  const local = zonedParts(session.timeZone, at);
  if (isWeekend(local.weekday)) return false;
  const open = zonedWallToUtc(session.timeZone, local, session.open);
  const close = zonedWallToUtc(session.timeZone, local, session.close);
  return at >= open && at < close;
}

export type SessionRows = { session: SessionDef; segments: Segment[] }[];

export interface SessionStatus {
  open: boolean;
  /** UTC ms: when the current session opened / will close (open), or next opens (closed) */
  openedAt: number | null;
  closesAt: number | null;
  opensAt: number | null;
}

/** Whether a session is open at `at`, and when it next changes, on its own local calendar. */
export function sessionStatus(session: SessionDef, at: number): SessionStatus {
  const local = zonedParts(session.timeZone, at);
  for (let k = 0; k <= 7; k++) {
    const d = shiftDate(local, k);
    if (isWeekend(d.weekday)) continue;
    const o = zonedWallToUtc(session.timeZone, d, session.open);
    const c = zonedWallToUtc(session.timeZone, d, session.close);
    if (at >= c) continue;
    if (at >= o) return { open: true, openedAt: o, closesAt: c, opensAt: null };
    return { open: false, openedAt: null, closesAt: null, opensAt: o };
  }
  return { open: false, openedAt: null, closesAt: null, opensAt: null };
}

// ---------------------------------------------------------------------------
// Overlaps
// ---------------------------------------------------------------------------

export interface Overlap {
  a: SessionDef;
  b: SessionDef;
  start: number;
  end: number;
  rawStart: number;
  rawEnd: number;
}

/** Every stretch of the selected day where two sessions are open together. */
export function overlaps(rows: SessionRows): Overlap[] {
  const out: Overlap[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      for (const x of rows[i].segments) {
        for (const y of rows[j].segments) {
          const rawStart = Math.max(x.rawStart, y.rawStart);
          const rawEnd = Math.min(x.rawEnd, y.rawEnd);
          if (rawEnd - rawStart < 0.25) continue;
          const start = clamp(rawStart, 0, 24);
          const end = clamp(rawEnd, 0, 24);
          if (end - start <= 0) continue;
          out.push({ a: rows[i].session, b: rows[j].session, start, end, rawStart, rawEnd });
        }
      }
    }
  }
  return out.sort((p, q) => p.start - q.start);
}

// ---------------------------------------------------------------------------
// Weekend
// ---------------------------------------------------------------------------

/** Forex is shut from Friday 17:00 to Sunday 17:00, New York time. */
export function isForexWeekend(at: number): boolean {
  const ny = zonedParts('America/New_York', at);
  const h = ny.hour + ny.minute / 60;
  return ny.weekday === 6 || (ny.weekday === 5 && h >= 17) || (ny.weekday === 0 && h < 17);
}

/**
 * Start of the first day (in `timeZone`, from `todayStart` on) on which any session opens.
 * Used to show the coming schedule while the market is closed for the weekend.
 */
export function nextTradingDayStart(timeZone: string, todayStart: number): number {
  const today = zonedParts(timeZone, todayStart);
  for (let k = 0; k <= 4; k++) {
    const start = k === 0 ? todayStart : zonedWallToUtc(timeZone, shiftDate(today, k), 0);
    const opens = SESSIONS.some((s) => sessionSegments(s, start).some((seg) => seg.rawStart >= 0 && seg.rawStart < 24));
    if (opens) return start;
  }
  return todayStart;
}

// ---------------------------------------------------------------------------
// Volume model
// ---------------------------------------------------------------------------

export const VOLUME_SAMPLES = 288; // + 1 endpoint

function gaussianBlur(values: number[], radius: number): number[] {
  const sigma = radius / 2;
  const kernel: number[] = [];
  for (let k = -radius; k <= radius; k++) kernel.push(Math.exp(-(k * k) / (2 * sigma * sigma)));
  const n = values.length;
  return values.map((_, i) => {
    let sum = 0;
    let wsum = 0;
    for (let k = -radius; k <= radius; k++) {
      const j = clamp(i + k, 0, n - 1);
      const w = kernel[k + radius];
      sum += values[j] * w;
      wsum += w;
    }
    return sum / wsum;
  });
}

/** Smoothed, un-normalised activity: 289 samples across the selected day. */
function rawVolume(rows: SessionRows): number[] {
  const raw: number[] = [];
  for (let i = 0; i <= VOLUME_SAMPLES; i++) {
    const t = (i * 24) / VOLUME_SAMPLES;
    let v = 0.12;
    for (const { session, segments } of rows) {
      for (const s of segments) {
        if (t < s.rawStart || t >= s.rawEnd) continue;
        const span = Math.max(0.5, s.rawEnd - s.rawStart);
        const edge = Math.min(t - s.rawStart, s.rawEnd - t) / (span / 2);
        v += session.weight * Math.min(1, 0.35 + 0.65 * Math.min(1, edge));
      }
    }
    raw.push(v);
  }
  return gaussianBlur(gaussianBlur(raw, 18), 12);
}

let weekdayPeak: number | null = null;

/**
 * Peak of the smoothed curve on ordinary weekdays (UTC days in January and July, so both DST
 * states are covered). Used as the top of the scale so a quiet day (a weekend, or a day with only
 * a session's tail in it) reads as quiet instead of being stretched to fill the graph.
 */
function typicalPeak(): number {
  if (weekdayPeak === null) {
    const days = [Date.UTC(2026, 0, 14), Date.UTC(2026, 6, 15)];
    weekdayPeak = Math.max(
      ...days.map((d) => Math.max(...rawVolume(SESSIONS.map((session) => ({ session, segments: sessionSegments(session, d) }))))),
    );
  }
  return weekdayPeak;
}

/** 289 normalised (0–1) activity values across the selected day. */
export function volumeSamples(rows: SessionRows): number[] {
  const smooth = rawVolume(rows);
  const lo = Math.min(0.12, ...smooth);
  const hi = Math.max(typicalPeak(), ...smooth);
  const range = hi - lo;
  return smooth.map((v) => (range > 1e-9 ? clamp((v - lo) / range, 0, 1) : 0));
}

/** Linear read of the sampled curve at fraction `f` (0–1) of the day. */
export function sampleAt(values: number[], f: number): number {
  const x = clamp(f, 0, 1) * (values.length - 1);
  const i = Math.floor(x);
  const j = Math.min(values.length - 1, i + 1);
  return values[i] + (values[j] - values[i]) * (x - i);
}

export type VolumeLevel = 'low' | 'medium' | 'high';

export const volumeLevel = (v: number): VolumeLevel => (v > 0.66 ? 'high' : v > 0.33 ? 'medium' : 'low');

/** Four-step activity scale used across the page. */
export type Activity = 'quiet' | 'light' | 'busy' | 'very-busy';
export const ACTIVITY_LABEL: Record<Activity, string> = { quiet: 'Quiet', light: 'Light', busy: 'Busy', 'very-busy': 'Very busy' };
/** Lower edge of each step on a 0–100 scale. */
export const ACTIVITY_TIERS: readonly { key: Activity; from: number }[] = [
  { key: 'light', from: 25 },
  { key: 'busy', from: 50 },
  { key: 'very-busy', from: 75 },
];
export const activityOf = (v: number): Activity => {
  const p = v * 100;
  return p >= 75 ? 'very-busy' : p >= 50 ? 'busy' : p >= 25 ? 'light' : 'quiet';
};

export interface ActivityBlock {
  from: number; // hour
  to: number;
  value: number;
  level: Activity;
  sessions: SessionDef[];
}

/** The day in blocks of `size` hours: average activity and which sessions are open in it. */
export function activityBlocks(values: number[], rows: SessionRows, size = 3): ActivityBlock[] {
  const out: ActivityBlock[] = [];
  for (let from = 0; from < 24; from += size) {
    const to = Math.min(24, from + size);
    const i0 = Math.round((from / 24) * (values.length - 1));
    const i1 = Math.round((to / 24) * (values.length - 1));
    let sum = 0;
    for (let i = i0; i <= i1; i++) sum += values[i];
    const value = sum / (i1 - i0 + 1);
    const sessions = rows.filter((r) => r.segments.some((s) => s.start < to && s.end > from)).map((r) => r.session);
    out.push({ from, to, value, level: activityOf(value), sessions });
  }
  return out;
}

/** The stretch around the day's highest activity (within 8% of the peak), in hours. */
export function peakWindow(values: number[]): { from: number; to: number } | null {
  const max = Math.max(...values);
  if (max < 0.2) return null;
  const top = values.indexOf(max);
  let i0 = top;
  let i1 = top;
  while (i0 > 0 && values[i0 - 1] >= max - 0.08) i0--;
  while (i1 < values.length - 1 && values[i1 + 1] >= max - 0.08) i1++;
  const h = (i: number) => (i / (values.length - 1)) * 24;
  return { from: h(i0), to: h(i1) };
}

/** The y coordinate (in the 1000×100 viewBox) of a normalised volume value. */
export const volumeY = (v: number) => 96 - v * 91;

export type Pt = readonly [number, number];
const f1 = (n: number) => Math.round(n * 10) / 10;

/** Catmull–Rom spline through the points, as cubic Bézier segments. */
export function smoothPath(points: Pt[]): string {
  if (points.length === 0) return '';
  let d = `M${f1(points[0][0])},${f1(points[0][1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${f1(c1x)},${f1(c1y)} ${f1(c2x)},${f1(c2y)} ${f1(p2[0])},${f1(p2[1])}`;
  }
  return d;
}

export function volumePaths(values: number[]): { line: string; area: string } {
  const pts: Pt[] = values.map((v, i) => [(i / (values.length - 1)) * 1000, volumeY(v)]);
  const line = smoothPath(pts);
  return { line, area: `${line}L1000,100L0,100Z` };
}

// ---------------------------------------------------------------------------
// Accumulation / Manipulation / Distribution (schematic, New York clock)
// ---------------------------------------------------------------------------

export type Phase = 'accumulation' | 'manipulation' | 'distribution';

export const PHASE_LABEL: Record<Phase, string> = {
  accumulation: 'Accumulation',
  manipulation: 'Manipulation',
  distribution: 'Distribution',
};

export const PHASE_NOTE: Record<Phase, string> = {
  accumulation: 'Asia sets the range. Price drifts sideways in a tight band while positions build up.',
  manipulation: 'Around the London open, price often runs one side of the Asian range to take out stops before the real move.',
  distribution: 'With New York in, the day\'s main move tends to run, usually away from the earlier fake-out.',
};

export const PHASE_NY: Record<Phase, string> = {
  accumulation: '8 pm – 3 am',
  manipulation: '2 am – 5 am',
  distribution: '8:30 – 11:30 am',
};

const NY = 'America/New_York';

const PHASE_HOURS: readonly { phase: Phase; start: number; end: number }[] = [
  { phase: 'accumulation', start: 20, end: 27 }, // 8 PM → 3 AM next day
  { phase: 'manipulation', start: 2, end: 5 },
  { phase: 'distribution', start: 8.5, end: 11.5 },
];

export interface PhaseSegment extends Segment {
  phase: Phase;
}

export function amdSegments(dayStart: number): PhaseSegment[] {
  const mid = zonedParts(NY, dayStart + DAY_MS / 2);
  const out: PhaseSegment[] = [];
  for (const k of [-2, -1, 0, 1]) {
    const date = shiftDate(mid, k);
    for (const p of PHASE_HOURS) {
      if (date.weekday === 6) continue; // Saturday: closed
      if (date.weekday === 0 && p.start < 17) continue; // Sunday: nothing before the 17:00 reopen
      if (date.weekday === 5 && p.start >= 17) continue; // Friday: nothing after the 17:00 close
      const rawStart = (zonedWallToUtc(NY, date, p.start) - dayStart) / HOUR_MS;
      const rawEnd = (zonedWallToUtc(NY, date, p.end) - dayStart) / HOUR_MS;
      const start = clamp(rawStart, 0, 24);
      const end = clamp(rawEnd, 0, 24);
      if (end - start < 0.25) continue;
      out.push({ phase: p.phase, start, end, rawStart, rawEnd });
    }
  }
  out.sort((a, b) => a.start - b.start || a.end - b.end);
  // where two phases overlap, the later one takes over: the earlier one is drawn up to
  // where the next begins (its own hours, rawStart–rawEnd, stay as they are)
  for (let i = 0; i < out.length - 1; i++) out[i].end = Math.min(out[i].end, out[i + 1].start);
  return out.filter((s) => s.end - s.start >= 0.25);
}

/** The phase covering hour `h`; where two overlap, the one that started last wins. */
export function phaseAt(segments: PhaseSegment[], h: number): Phase | null {
  let best: PhaseSegment | null = null;
  for (const s of segments) {
    if (h >= s.start && h < s.end && (!best || s.start >= best.start)) best = s;
  }
  return best?.phase ?? null;
}

const triangularWave = (x: number) => 1 - 4 * Math.abs(x - Math.floor(x) - 0.5);
/** How many times accumulation swings across its range, and how wide the range is. */
const ACC_CYCLES = 4;
const ACC_SWING = 0.09;

function lerpPoints(points: Pt[], t: number): number {
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (t <= x1 || i === points.length - 2) return y0 + ((y1 - y0) * (t - x0)) / (x1 - x0);
  }
  return points[points.length - 1][1];
}

const MANIPULATION: Pt[] = [
  [0, 0.45],
  [0.35, 0.14],
  [0.55, 0.34],
  [0.78, 0.06],
  [1, 0.3],
];
const DISTRIBUTION: Pt[] = [
  [0, 0.3],
  [0.35, 0.72],
  [0.58, 0.48],
  [1, 0.96],
];

/** Shape value (0–1) of a phase at normalised position t (0–1). */
export function phaseValue(phase: Phase, t: number): number {
  if (phase === 'accumulation') return 0.5 + ACC_SWING * triangularWave(t * ACC_CYCLES);
  return lerpPoints(phase === 'manipulation' ? MANIPULATION : DISTRIBUTION, clamp(t, 0, 1));
}

/** Every corner of the piecewise-linear shape, so a polyline through them is exact. */
function phaseBreaks(phase: Phase): number[] {
  if (phase === 'accumulation') return Array.from({ length: ACC_CYCLES * 2 + 1 }, (_, j) => j / (ACC_CYCLES * 2));
  return (phase === 'manipulation' ? MANIPULATION : DISTRIBUTION).map(([t]) => t);
}

export const AMD_W = 1000;
export const AMD_H = 120;
export const amdY = (v: number) => AMD_H - 10 - v * (AMD_H - 24);
const hx = (h: number) => (h / 24) * AMD_W;

export interface AmdShape {
  phase: Phase;
  d: string;
  /** the drawn corners, left to right, in viewBox units */
  pts: Pt[];
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface AmdGraph {
  shapes: AmdShape[];
  gaps: string[];
}

export function amdGraph(segments: PhaseSegment[]): AmdGraph {
  const shapes: AmdShape[] = [];
  for (const s of segments) {
    const len = s.rawEnd - s.rawStart;
    const t0 = (s.start - s.rawStart) / len;
    const t1 = (s.end - s.rawStart) / len;
    const ts = [t0, ...phaseBreaks(s.phase).filter((t) => t > t0 && t < t1), t1];
    const pts: Pt[] = ts.map((t) => [hx(s.rawStart + t * len), amdY(phaseValue(s.phase, t))]);
    // a phase that takes over from the one before carries on from where that one stopped
    const prev = shapes[shapes.length - 1];
    if (prev && Math.abs(prev.x1 - pts[0][0]) < 0.5) pts[0] = [pts[0][0], prev.y1];
    shapes.push({
      phase: s.phase,
      d: pts.map(([x, y], i) => `${i ? 'L' : 'M'}${f1(x)},${f1(y)}`).join(''),
      pts,
      x0: pts[0][0],
      y0: pts[0][1],
      x1: pts[pts.length - 1][0],
      y1: pts[pts.length - 1][1],
    });
  }

  // dotted connectors through every stretch with no phase
  const gaps: string[] = [];
  if (shapes.length === 0) {
    const y = amdY(0.5);
    return { shapes, gaps: [`M0,${y}L${AMD_W},${y}`] };
  }
  let cx = 0;
  let cy = shapes[0].y0;
  for (const s of shapes) {
    if (s.x0 > cx + 0.5) gaps.push(`M${f1(cx)},${f1(cy)}L${f1(s.x0)},${f1(s.y0)}`);
    if (s.x1 > cx) {
      cx = s.x1;
      cy = s.y1;
    }
  }
  if (cx < AMD_W - 0.5) gaps.push(`M${f1(cx)},${f1(cy)}L${AMD_W},${f1(cy)}`);
  return { shapes, gaps };
}

/**
 * Height of the drawn AMD path (in viewBox units) at hour `h`: on the phase line drawn
 * there, or along the dotted line between phases.
 */
export function amdYAt(shapes: AmdShape[], h: number): number {
  if (!shapes.length) return amdY(0.5);
  const x = (h / 24) * AMD_W;
  const on = shapes.filter((s) => x >= s.x0 && x <= s.x1).pop();
  if (on) return lerpPoints(on.pts, x);
  const before = shapes.filter((s) => s.x1 <= x).sort((a, b) => b.x1 - a.x1)[0];
  const after = shapes.filter((s) => s.x0 >= x).sort((a, b) => a.x0 - b.x0)[0];
  if (before && after) return before.y1 + ((after.y0 - before.y1) * (x - before.x1)) / Math.max(1e-6, after.x0 - before.x1);
  return before ? before.y1 : after!.y0;
}
