'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Counts a number up to its new value (ease-out), so stats settle in rather than jump. */
export function useCountUp(target: number, ms = 650) {
  const [v, setV] = useState(target);
  const from = useRef(0);
  useEffect(() => {
    if (!Number.isFinite(target) || reduced()) {
      from.current = target;
      const id = requestAnimationFrame(() => setV(target));
      return () => cancelAnimationFrame(id);
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      setV(a + (target - a) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = target;
    };
  }, [target, ms]);
  return v;
}

/** True once the page has scrolled, for the top bar's hairline. */
export function useScrolled(px = 4) {
  const [s, setS] = useState(false);
  useEffect(() => {
    const on = () => setS(window.scrollY > px);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [px]);
  return s;
}

/**
 * The current time, refreshed every `ms`, so countdowns stay current. Null on the server and while
 * hydrating: the page is prerendered at build time, so anything drawn from the time waits for the
 * browser (or it won't match the HTML). Components that mount later get the time straight away.
 */
export function useNow(ms = 30000): Date | null {
  const now = useRef<Date | null>(null);
  const subscribe = useCallback(
    (changed: () => void) => {
      const id = setInterval(() => {
        now.current = new Date();
        changed();
      }, ms);
      return () => clearInterval(id);
    },
    [ms],
  );
  return useSyncExternalStore(subscribe, () => (now.current ??= new Date()), () => null);
}

/** Global single-key shortcuts that stay quiet while typing or when a dialog is open. */
export function useKey(key: string, fn: (e: KeyboardEvent) => void, enabled = true) {
  const ref = useRef(fn);
  useLayoutEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    if (!enabled) return;
    const on = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      if (document.querySelector('dialog[open]')) return;
      if (e.key.toLowerCase() === key) {
        e.preventDefault();
        ref.current(e);
      }
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [key, enabled]);
}
