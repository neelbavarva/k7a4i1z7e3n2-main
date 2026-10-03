import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { DAY_MS, clamp, zonedDayStart } from './marketTime';
import {
  SESSIONS,
  activityBlocks,
  amdGraph,
  amdSegments,
  isForexWeekend,
  nextTradingDayStart,
  overlaps,
  peakWindow,
  sessionSegments,
  sessionStatus,
  volumePaths,
  volumeSamples,
} from './marketModel';
import type { SessionId, SessionStatus } from './marketModel';
import { normaliseZone } from './zones';

// ---------------------------------------------------------------------------
// Storage (never throws: private windows and blocked storage just fall back)
// ---------------------------------------------------------------------------

export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

const KEY_TZ = 'tj-mh-tz';
const KEY_24 = 'tj-mh-24';

function initialTimezone(): string {
  const stored = normaliseZone(readStorage(KEY_TZ));
  if (stored) return stored;
  let detected: string | undefined;
  try {
    detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    detected = undefined;
  }
  return normaliseZone(detected) ?? 'UTC';
}

/** Timezone and clock format, remembered between visits. */
export function useSettings() {
  const [timezone, setTimezone] = useState<string>(initialTimezone);
  const [is24Hour, setIs24Hour] = useState<boolean>(() => readStorage(KEY_24) === '1');
  useEffect(() => writeStorage(KEY_TZ, timezone), [timezone]);
  useEffect(() => writeStorage(KEY_24, is24Hour ? '1' : '0'), [is24Hour]);
  return { timezone, setTimezone, is24Hour, setIs24Hour };
}

/** The current time, refreshed every 30 s and as soon as the tab is visible again. */
export function useClock(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => setNow(Date.now());
    // first tick on the next whole minute, so the clock never lags the system time by long
    const lead = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    const id = window.setInterval(tick, intervalMs);
    const onVisible = () => {
      if (!document.hidden) tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearTimeout(lead);
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);
  return now;
}

// ---------------------------------------------------------------------------
// Everything the page shows for one timezone and moment
// ---------------------------------------------------------------------------

export function useMarketDay(timezone: string, nowMs: number) {
  const todayStart = useMemo(() => zonedDayStart(timezone, nowMs), [timezone, nowMs]);
  const weekend = isForexWeekend(nowMs);
  // while forex is shut for the weekend, the charts show the next trading day
  const dayStart = useMemo(() => (weekend ? nextTradingDayStart(timezone, todayStart) : todayStart), [weekend, timezone, todayStart]);
  const preview = dayStart !== todayStart;

  const rows = useMemo(() => SESSIONS.map((session) => ({ session, segments: sessionSegments(session, dayStart) })), [dayStart]);

  const status = useMemo(() => {
    const o = {} as Record<SessionId, SessionStatus>;
    for (const s of SESSIONS) o[s.id] = sessionStatus(s, nowMs);
    return o;
  }, [nowMs]);

  const volume = useMemo(() => {
    const values = volumeSamples(rows);
    return { values, ...volumePaths(values), blocks: activityBlocks(values, rows), peak: peakWindow(values) };
  }, [rows]);

  const amd = useMemo(() => {
    const segments = amdSegments(dayStart);
    return { segments, ...amdGraph(segments) };
  }, [dayStart]);

  const crossings = useMemo(() => overlaps(rows), [rows]);

  const livePercent = clamp(((nowMs - todayStart) / DAY_MS) * 100, 0, 100);

  return { timezone, nowMs, todayStart, dayStart, weekend, preview, rows, status, volume, amd, crossings, livePercent };
}

export type MarketDay = ReturnType<typeof useMarketDay>;

// ---------------------------------------------------------------------------
// Shared scrub line
// ---------------------------------------------------------------------------

const RETURN_MS = 420;

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export interface Scrub {
  /** where the line is, 0–100 */
  percent: number;
  /** null while following live time */
  scrubPercent: number | null;
  dragging: boolean;
  onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  reset: () => void;
  set: (pct: number | null) => void;
}

/**
 * One time line shared by every chart. Press anywhere on a chart (or grab the line) and drag
 * to scrub through the day; on release it eases back to now. Double-click or Esc resets.
 */
export function useScrub(livePercent: number): Scrub {
  const [scrubPercent, setScrubPercent] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const liveRef = useRef(livePercent);
  liveRef.current = livePercent;
  const scrubRef = useRef<number | null>(scrubPercent);
  scrubRef.current = scrubPercent;
  const dragRef = useRef<{ track: HTMLElement; pointerId: number } | null>(null);
  const rafRef = useRef<number | null>(null);

  const cancel = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  const endDrag = useCallback(() => {
    dragRef.current = null;
    setDragging(false);
    document.documentElement.classList.remove('is-scrubbing');
  }, []);

  const reset = useCallback(() => {
    cancel();
    endDrag();
    setScrubPercent(null);
  }, [cancel, endDrag]);

  const animateBack = useCallback(
    (from: number) => {
      cancel();
      if (prefersReducedMotion()) {
        setScrubPercent(null);
        return;
      }
      const t0 = performance.now();
      const step = (t: number) => {
        const p = Math.min(1, (t - t0) / RETURN_MS);
        const eased = 1 - (1 - p) ** 3;
        if (p < 1) {
          setScrubPercent(from + (liveRef.current - from) * eased);
          rafRef.current = requestAnimationFrame(step);
        } else {
          rafRef.current = null;
          setScrubPercent(null);
        }
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [cancel],
  );

  useEffect(
    () => () => {
      cancel();
      document.documentElement.classList.remove('is-scrubbing');
    },
    [cancel],
  );

  // Esc returns to now from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && scrubRef.current !== null && !document.querySelector('.picker')) reset();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reset]);

  const pctFrom = (clientX: number, track: HTMLElement) => {
    const r = track.getBoundingClientRect();
    return r.width > 0 ? clamp(((clientX - r.left) / r.width) * 100, 0, 100) : 0;
  };

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const track = e.currentTarget.closest<HTMLElement>('[data-track]');
      if (!track) return;
      if (e.detail >= 2) {
        reset();
        return;
      }
      e.preventDefault();
      cancel();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* capture unavailable */
      }
      dragRef.current = { track, pointerId: e.pointerId };
      setDragging(true);
      document.documentElement.classList.add('is-scrubbing');
      setScrubPercent(pctFrom(e.clientX, track));
    },
    [cancel, reset],
  );

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    setScrubPercent(pctFrom(e.clientX, d.track));
  }, []);

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const d = dragRef.current;
      if (!d || d.pointerId !== e.pointerId) return;
      endDrag();
      const from = scrubRef.current;
      if (from !== null) animateBack(from);
    },
    [animateBack, endDrag],
  );

  const set = useCallback(
    (pct: number | null) => {
      cancel();
      setScrubPercent(pct === null ? null : clamp(pct, 0, 100));
    },
    [cancel],
  );

  return {
    percent: scrubPercent ?? livePercent,
    scrubPercent,
    dragging,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    reset,
    set,
  };
}
