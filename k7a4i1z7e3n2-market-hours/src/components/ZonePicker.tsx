import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { formatClock } from '../marketTime';
import { searchZones } from '../zones';

/**
 * Command-palette timezone switcher: type a city, country, abbreviation (IST, EST) or offset
 * (+5:30); arrows to move, Enter to pick, Esc or a click outside to close.
 */
export default function ZonePicker({
  current,
  nowMs,
  is24Hour,
  onPick,
  onClose,
}: {
  current: string;
  nowMs: number;
  is24Hour: boolean;
  onPick: (tz: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const results = useMemo(() => searchZones(query, nowMs, current), [query, nowMs, current]);

  useEffect(() => {
    const returnFocus = document.activeElement as HTMLElement | null;
    input.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
      if (returnFocus && document.contains(returnFocus)) returnFocus.focus?.({ preventScroll: true });
    };
  }, []);

  // with an empty query, start on the zone already in use
  useEffect(() => {
    const i = query ? 0 : Math.max(0, results.findIndex((z) => z.tz === current));
    setActive(i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  useEffect(() => {
    list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const pick = (tz: string | undefined) => {
    if (!tz) return;
    onPick(tz);
    onClose();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(results[active]?.tz);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab') {
      e.preventDefault();
    }
  };

  return (
    <div className="picker-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="picker" role="dialog" aria-modal="true" aria-label="Choose your timezone">
        <div className="picker-search">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search a city, country, IST, +5:30…"
            aria-label="Search timezones"
            aria-controls="zone-list"
            aria-activedescendant={results[active] ? `zone-${active}` : undefined}
            autoComplete="off"
            spellCheck="false"
          />
          <kbd className="picker-esc">Esc</kbd>
          <button type="button" className="picker-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
        {!query && <p className="picker-group">Main financial centres</p>}
        <ul className="picker-list" id="zone-list" role="listbox" ref={list}>
          {results.map((z, i) => (
            <li
              key={z.tz}
              id={`zone-${i}`}
              role="option"
              aria-selected={i === active}
              data-active={i === active}
              className={z.tz === current ? 'is-current' : ''}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(z.tz)}
            >
              <span className="picker-sym">
                {z.city}
                <span className="picker-region muted">{z.region}</span>
              </span>
              <span className="picker-label muted">{z.offsetLabel}</span>
              {z.tz === current && <span className="picker-here muted">Selected</span>}
              <span className="picker-time">{formatClock(nowMs, z.tz, is24Hour)}</span>
            </li>
          ))}
          {!results.length && <li className="picker-empty muted">Nothing matches “{query.trim()}”.</li>}
        </ul>
        <div className="picker-foot muted">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> to move
          </span>
          <span>
            <kbd>Enter</kbd> to choose
          </span>
        </div>
      </div>
    </div>
  );
}
