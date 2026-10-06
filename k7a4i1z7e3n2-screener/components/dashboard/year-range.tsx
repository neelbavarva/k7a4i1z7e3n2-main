'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export type Era = { label: string; start: number; end: number; title: string };

type Slot = 'start' | 'end';

/**
 * The custom range: every year with data, a decade to a row. Pick the first year, then the last,
 * and the band in between fills in (it follows the pointer, or the arrow keys, before you commit).
 * The From / To slots on top pick one end again on its own; eras jump to a bubble's run-up and
 * crash. A finished range applies straight away and closes; a new first year applies as soon as it
 * makes a valid range with the current last year, so the chart keeps up.
 */
export function YearRangePicker({
  years,
  start,
  end,
  eras,
  onPick,
  onDone,
}: {
  years: number[];
  start: number;
  end: number;
  eras: Era[];
  onPick: (start: number, end: number) => void;
  onDone: () => void;
}) {
  const [from, setFrom] = useState(start);
  const [to, setTo] = useState<number | null>(end);
  const [slot, setSlot] = useState<Slot>('start');
  const [hover, setHover] = useState<number | null>(null);
  const [cursor, setCursor] = useState(start);
  const grid = useRef<HTMLDivElement>(null);
  const moved = useRef(false);

  const has = useMemo(() => new Set(years), [years]);
  const first = years[0];
  const last = years[years.length - 1];
  const decades = useMemo(() => {
    const out: number[] = [];
    for (let d = Math.floor(first / 10) * 10; d <= last; d += 10) out.push(d);
    return out;
  }, [first, last]);

  // after an arrow key, focus follows the cursor
  useEffect(() => {
    if (!moved.current) return;
    moved.current = false;
    grid.current?.querySelector<HTMLElement>(`[data-year="${cursor}"]`)?.focus();
  }, [cursor]);

  const pick = (y: number) => {
    setCursor(y);
    if (slot === 'start') {
      setFrom(y);
      setSlot('end');
      if (to !== null && y <= to) onPick(y, to);
      else setTo(null);
      return;
    }
    // picking the last year: one before the first starts the range over from there
    if (y < from) {
      setFrom(y);
      setTo(null);
      return;
    }
    setTo(y);
    setSlot('start');
    onPick(from, y);
    onDone();
  };

  // what the grid shows: the range, or the one the pointer (or cursor) would make
  let a = from;
  let b = to;
  if (hover !== null) {
    if (slot === 'end') {
      if (hover >= from) b = hover;
      else [a, b] = [hover, null];
    } else if (to !== null && hover <= to) a = hover;
    else [a, b] = [hover, null];
  }
  const span = b === null ? null : b - a + 1;

  const onKey = (e: React.KeyboardEvent) => {
    const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -10, ArrowDown: 10 } as Record<string, number>)[e.key];
    if (!step) return;
    e.preventDefault();
    let y = cursor + step;
    if (!has.has(y)) y = step < 0 ? Math.max(first, y) : Math.min(last, y);
    if (!has.has(y)) return;
    moved.current = true;
    setCursor(y);
    setHover(y);
  };

  return (
    <div className="yr">
      <div className="yr-slots">
        {(['start', 'end'] as const).map((s, i) => (
          <button
            key={s}
            type="button"
            className="yr-slot"
            aria-pressed={slot === s}
            onClick={() => setSlot(s)}
          >
            <span>{s === 'start' ? 'From' : 'To'}</span>
            <b className={hover !== null && (i === 0 ? a !== from : b !== to) ? 'is-preview' : undefined}>{i === 0 ? a : b ?? '—'}</b>
          </button>
        ))}
        <span className="yr-span" aria-live="polite">
          {span === null ? 'Pick the last year' : `${span} year${span === 1 ? '' : 's'}`}
        </span>
      </div>

      {eras.length > 0 && (
        <div className="yr-eras" role="group" aria-label="Bubble eras">
          <span>Eras</span>
          {eras.map(e => (
            <button
              key={e.label}
              type="button"
              className="yr-era"
              title={e.title}
              aria-pressed={to !== null && from === e.start && to === e.end}
              onClick={() => {
                onPick(e.start, e.end);
                onDone();
              }}
            >
              {e.label}
              <small>
                {e.start}–{String(e.end).slice(2)}
              </small>
            </button>
          ))}
        </div>
      )}

      <div
        className={`yr-grid${hover !== null ? ' is-preview' : ''}`}
        ref={grid}
        role="group"
        aria-label={slot === 'start' ? 'Pick the first year' : 'Pick the last year'}
        onKeyDown={onKey}
        onMouseLeave={() => setHover(null)}
      >
        {decades.map(d => (
          <div className="yr-row" key={d}>
            <span className="yr-decade" aria-hidden="true">
              {d}s
            </span>
            {Array.from({ length: 10 }, (_, i) => d + i).map((y, i) => {
              const on = b !== null && y >= a && y <= b;
              const cls = [
                'yr-cell',
                on && 'in',
                y === a && 'is-start',
                (y === b || (b === null && y === a)) && 'is-end',
                i === 0 && 'row-first',
                i === 9 && 'row-last',
              ]
                .filter(Boolean)
                .join(' ');
              return (
                <button
                  key={y}
                  type="button"
                  className={cls}
                  data-year={y}
                  disabled={!has.has(y)}
                  tabIndex={y === cursor ? 0 : -1}
                  aria-label={String(y)}
                  aria-pressed={y === from || y === to}
                  onClick={() => pick(y)}
                  onMouseEnter={() => setHover(y)}
                  onFocus={() => {
                    setCursor(y);
                    setHover(y);
                  }}
                  onBlur={() => setHover(null)}
                >
                  {String(y).slice(2)}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <p className="yr-foot">
        <span>{slot === 'start' ? 'Click a first year, then a last year.' : `From ${from}: now click the last year.`}</span>
        <span className="muted">
          Data {first}–{last}
        </span>
      </p>
    </div>
  );
}
