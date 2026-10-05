'use client';

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, dayKey, fmtDay, fmtMonth, forexDay, localStamp, mondayOf, monthKey, parseDay, shiftMonth } from '@/lib/journal';

const DOW = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const pad = (n: number) => String(n).padStart(2, '0');
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

/**
 * Day and time in the site's own look, in place of the browser's date-time popup: a Monday-first
 * month (six rows, so it never changes height), a dot on days that already have trades, and a
 * 24-hour time typed or nudged with ↑ ↓. Nothing after `now` can be picked. The value is a local
 * "YYYY-MM-DDTHH:mm", like a datetime-local input's.
 */
export default function DateTimePicker({
  value,
  onChange,
  now,
  counts,
  invalid,
}: {
  value: string;
  onChange: (v: string) => void;
  now: Date;
  counts?: Map<string, number>;
  invalid?: boolean;
}) {
  const parsed = new Date(value);
  const at = Number.isNaN(parsed.getTime()) ? now : parsed;
  const [view, setView] = useState(() => monthKey(at));
  const grid = useRef<HTMLDivElement>(null);
  const minutes = useRef<HTMLInputElement>(null);
  const moveFocus = useRef(false);

  const today = dayKey(now);
  const picked = dayKey(at);
  const days = useMemo(() => {
    const start = mondayOf(parseDay(`${view}-01`));
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [view]);
  // the one day Tab lands on: the picked day if it's showing, else the 1st of the month
  const tabDay = days.some((d) => dayKey(d) === picked) ? picked : `${view}-01`;

  const set = (d: Date, h = at.getHours(), m = at.getMinutes()) => onChange(localStamp(new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m)));

  const pickDay = (d: Date, focus = false) => {
    const day = dayKey(d) > today ? parseDay(today) : d;
    set(day);
    setView(monthKey(day));
    moveFocus.current = focus;
  };

  // after a keyboard move, focus follows the picked day (into the next month too)
  useEffect(() => {
    if (!moveFocus.current) return;
    moveFocus.current = false;
    grid.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
  });

  const onGridKey = (e: React.KeyboardEvent) => {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    let next: Date | null = null;
    if (e.key in step) next = addDays(at, step[e.key]);
    else if (e.key === 'Home') next = mondayOf(at);
    else if (e.key === 'End') next = addDays(mondayOf(at), 6);
    else if (e.key === 'PageUp' || e.key === 'PageDown') {
      const m = at.getMonth() + (e.key === 'PageUp' ? -1 : 1);
      next = new Date(at.getFullYear(), m, Math.min(at.getDate(), daysIn(at.getFullYear(), m)));
    }
    if (!next) return;
    e.preventDefault();
    pickDay(next, true);
  };

  return (
    <div className={`dtp fade-in${invalid ? ' is-invalid' : ''}`}>
      <div className="dtp-head">
        <span className="dtp-month" aria-live="polite">
          {fmtMonth(view)}
        </span>
        <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={() => setView(shiftMonth(view, -1))} aria-label="Previous month">
          <ChevronLeft aria-hidden="true" />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-icon btn-sm"
          onClick={() => setView(shiftMonth(view, 1))}
          disabled={view >= monthKey(now)}
          aria-label="Next month"
        >
          <ChevronRight aria-hidden="true" />
        </button>
      </div>

      <div className="dtp-grid" ref={grid} onKeyDown={onGridKey} role="group" aria-label="Day">
        {DOW.map((d) => (
          <span key={d} className="dtp-dow" aria-hidden="true">
            {d}
          </span>
        ))}
        {days.map((d) => {
          const k = dayKey(d);
          const n = counts?.get(k) ?? 0;
          return (
            <button
              key={k}
              type="button"
              className={`dtp-day${monthKey(d) !== view ? ' is-out' : ''}${k === today ? ' is-today' : ''}`}
              aria-pressed={k === picked}
              aria-current={k === today ? 'date' : undefined}
              aria-label={`${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${n ? `, ${n} trade${n === 1 ? '' : 's'}` : ''}`}
              tabIndex={k === tabDay ? 0 : -1}
              disabled={k > today}
              onClick={() => pickDay(d)}
            >
              {d.getDate()}
              {n > 0 && <i aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <div className="dtp-foot">
        <span className="dtp-label" aria-hidden="true">
          Time
        </span>
        <div className="dtp-time" role="group" aria-label="Time, 24-hour">
          <TimeBox value={at.getHours()} max={23} label="Hour" onChange={(h) => set(at, h)} onFull={() => minutes.current?.focus()} />
          <span aria-hidden="true">:</span>
          <TimeBox value={at.getMinutes()} max={59} label="Minute" onChange={(m) => set(at, at.getHours(), m)} inputRef={minutes} />
        </div>
        <span className="dtp-fx">Forex day {fmtDay(parseDay(forexDay(at)))}</span>
      </div>
    </div>
  );
}

/** Two digits: type them (it moves on once the hour is clear), or ↑ ↓ to nudge, Shift for ten. */
function TimeBox({
  value,
  max,
  label,
  onChange,
  onFull,
  inputRef,
}: {
  value: number;
  max: number;
  label: string;
  onChange: (n: number) => void;
  onFull?: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      ref={inputRef}
      className="input dtp-num"
      inputMode="numeric"
      maxLength={2}
      aria-label={label}
      autoComplete="off"
      value={draft ?? pad(value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => setDraft(null)}
      onChange={(e) => {
        const t = e.target.value.replace(/\D/g, '').slice(0, 2);
        setDraft(t);
        if (t) onChange(Math.min(Number(t), max));
        if (t.length === 2 || (t && Number(t) * 10 > max)) onFull?.();
      }}
      onKeyDown={(e) => {
        const dir = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0;
        if (!dir) return;
        e.preventDefault();
        setDraft(null);
        const span = max + 1;
        onChange((((value + dir * (e.shiftKey ? 10 : 1)) % span) + span) % span);
      }}
    />
  );
}
