import { useCallback, useEffect, useRef, useState } from 'react';
import { judge } from '../pipeline/lib/values.js';
import { CAL_POLL_MINUTES } from './constants.js';

const BASE = import.meta.env.BASE_URL;

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

/**
 * The live calendar (api/calendar.js), with any actual values the hourly job has found merged
 * in from its saved copy. If the live one can't be reached (or the site is hosted without the
 * function, as on GitHub Pages), the saved copy on its own.
 */
async function loadCalendar() {
  const [live, saved] = await Promise.allSettled([
    getJson(`${BASE}api/calendar`),
    getJson(`${BASE}data/calendar.json?v=${Date.now()}`),
  ]);
  const copy = saved.status === 'fulfilled' ? saved.value : null;
  if (live.status === 'fulfilled' && Array.isArray(live.value?.events)) {
    const cal = live.value;
    // a sample copy's made-up actuals never mix with the real feed
    if (copy && !copy.demo) {
      const byId = new Map(copy.events.map((e) => [e.id, e]));
      cal.events = cal.events.map((e) => {
        const k = byId.get(e.id);
        if (e.a || !k?.a) return e;
        return { ...e, a: k.a, src: k.src, url: k.url, ...judge({ ...e, a: k.a }) };
      });
    }
    return { ...cal, from: 'live' };
  }
  if (copy) return { ...copy, from: 'saved' };
  throw live.reason ?? saved.reason;
}

/** The calendar, re-checked every few minutes while the page is open and visible. */
export function useCalendar() {
  const [state, setState] = useState({ cal: null, error: null, checkedAt: 0 });
  const [loading, setLoading] = useState(true);
  const busy = useRef(false);

  const load = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      const cal = await loadCalendar();
      setState({ cal, error: null, checkedAt: Date.now() });
    } catch (error) {
      setState((s) => ({ ...s, error, checkedAt: Date.now() }));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const every = CAL_POLL_MINUTES * 60 * 1000;
    let last = Date.now();
    const check = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < every - 1000) return;
      last = Date.now();
      load();
    };
    const timer = setInterval(check, 30 * 1000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [load]);

  return { ...state, loading, reload: load };
}
