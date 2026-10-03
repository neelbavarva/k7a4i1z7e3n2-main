import { useEffect, useMemo, useRef, useState } from 'react';
import { signed } from '../format.js';
import { matchesMarket, normalise, subName } from '../markets.js';
import MarketIcon from './MarketIcon.jsx';

/**
 * Command-palette style pair switcher: type to filter, arrows to move,
 * Enter to open, Esc or a click outside to close.
 */
export default function PairPicker({ pairs, current, onClose }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef(null);
  const list = useRef(null);

  const results = useMemo(() => {
    const q = normalise(query);
    return pairs.filter((p) => matchesMarket(p, q));
  }, [pairs, query]);

  useEffect(() => {
    const returnFocus = document.activeElement; // give focus back to whatever opened the picker
    input.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
      if (returnFocus && document.contains(returnFocus)) returnFocus.focus?.({ preventScroll: true });
    };
  }, []);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const open = (p) => {
    if (!p) return;
    onClose();
    // assign() keeps working from a 404 path too; on the normal page it only changes the hash
    window.location.assign(`${import.meta.env.BASE_URL}#/${p.id}`);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      open(results[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab') {
      e.preventDefault(); // keep focus inside the dialog
    }
  };

  return (
    <div className="picker-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="picker" role="dialog" aria-modal="true" aria-label="Switch market">
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
            placeholder="Search EUR, gold, nasdaq…"
            aria-label="Search markets"
            aria-controls="picker-list"
            aria-activedescendant={results[active] ? `pick-${results[active].id}` : undefined}
            autoComplete="off"
            spellCheck="false"
          />
          <kbd className="picker-esc">Esc</kbd>
          <button type="button" className="picker-cancel" onClick={onClose}>
            Cancel
          </button>
        </div>
        <ul className="picker-list" id="picker-list" role="listbox" ref={list}>
          {results.map((p, i) => {
            const side = p.score >= 15 ? 'up' : p.score <= -15 ? 'down' : 'flat';
            return (
              <li
                key={p.id}
                id={`pick-${p.id}`}
                role="option"
                aria-selected={i === active}
                data-active={i === active}
                className={p.id === current ? 'is-current' : ''}
                onMouseEnter={() => setActive(i)}
                onClick={() => open(p)}
              >
                <span className="picker-sym">
                  <MarketIcon pair={p} size={20} />
                  {p.symbol}
                  {subName(p) && <span className="muted"> {subName(p)}</span>}
                </span>
                <span className="picker-label muted">{p.label}</span>
                <span className={`picker-score ${side}`}>{signed(p.score)}</span>
                {p.id === current && <span className="picker-here muted">Viewing</span>}
              </li>
            );
          })}
          {!results.length && <li className="picker-empty muted">Nothing matches “{query.trim()}”.</li>}
        </ul>
        <div className="picker-foot muted">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> to move
          </span>
          <span>
            <kbd>Enter</kbd> to open
          </span>
        </div>
      </div>
    </div>
  );
}
