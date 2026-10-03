"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const reduced = () =>
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Counts a number up to its new value (ease-out), so stats settle in rather than jump. */
export function useCountUp(target, ms = 650) {
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
        let raf;
        const tick = (now) => {
            const p = Math.min(1, (now - start) / ms);
            const e = 1 - Math.pow(1 - p, 3);
            setV(a + (target - a) * e);
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
        window.addEventListener("scroll", on, { passive: true });
        return () => window.removeEventListener("scroll", on);
    }, [px]);
    return s;
}

/** Re-render every `ms` so relative times and session countdowns stay current. */
export function useNow(ms = 30000) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), ms);
        return () => clearInterval(id);
    }, [ms]);
    return now;
}

/** Global single-key shortcuts that stay quiet while typing or when a dialog is open. */
export function useKey(key, fn, enabled = true) {
    const ref = useRef(fn);
    useLayoutEffect(() => {
        ref.current = fn;
    });
    useEffect(() => {
        if (!enabled) return;
        const on = (e) => {
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            const t = e.target;
            if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
            if (document.querySelector('[role="dialog"]')) return;
            if (e.key.toLowerCase() === key) {
                e.preventDefault();
                ref.current(e);
            }
        };
        window.addEventListener("keydown", on);
        return () => window.removeEventListener("keydown", on);
    }, [key, enabled]);
}
