'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { RESEARCH_MARKETS } from '@/lib/worldbank/client';
import { MARKET_ALIASES, isCountry } from '@/lib/markets';
import { MarketIcon } from '@/components/ui/market-icon';
import { CheckIcon, SearchIcon } from '@/components/ui/icons';

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, '').trim();

/**
 * Command-palette market picker (same pattern as FX Fundamental Bias' pair switcher),
 * multi-select: type to filter, arrows to move, Enter to add or remove, Esc to close.
 */
export function MarketPicker({
  selected,
  onToggle,
  onClose,
  meta,
}: {
  selected: string[];
  onToggle: (code: string) => void;
  onClose: () => void;
  meta: (code: string) => string;
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    const q = norm(query);
    const all = RESEARCH_MARKETS.map(([code, name]) => ({ code, name }));
    const hits = q
      ? all.filter(m => norm(m.name).includes(q) || m.code.toLowerCase() === q || (MARKET_ALIASES[m.code] ?? []).some(a => a.includes(q)))
      : all;
    // countries first, then World and the regions
    return [...hits.filter(m => isCountry(m.code)), ...hits.filter(m => !isCountry(m.code))];
  }, [query]);

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

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const toggle = (code?: string) => {
    if (!code) return;
    if (selected.includes(code) && selected.length === 1) return; // keep at least one market
    onToggle(code);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(i => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(i => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      toggle(results[active]?.code);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Tab') {
      e.preventDefault(); // keep focus inside the dialog
    }
  };

  const firstRegion = results.findIndex(m => !isCountry(m.code));

  return (
    <div className="picker-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
      <div className="picker" role="dialog" aria-modal="true" aria-label="Choose markets">
        <div className="picker-search">
          <SearchIcon />
          <input
            ref={input}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search India, Japan, Latin America…"
            aria-label="Search markets"
            aria-controls="picker-list"
            aria-activedescendant={results[active] ? `pick-${results[active].code}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          <kbd>Esc</kbd>
          <button type="button" className="picker-cancel" onClick={onClose}>
            Done
          </button>
        </div>
        <ul className="picker-list" id="picker-list" role="listbox" aria-multiselectable="true" ref={list}>
          {results.map((m, i) => {
            const on = selected.includes(m.code);
            const locked = on && selected.length === 1;
            return [
              i === 0 && isCountry(m.code) && (
                <li key="g-countries" className="picker-group" role="presentation">
                  Countries
                </li>
              ),
              i === firstRegion && (
                <li key="g-regions" className="picker-group" role="presentation">
                  World and regions
                </li>
              ),
              <li
                key={m.code}
                id={`pick-${m.code}`}
                role="option"
                aria-selected={on}
                aria-disabled={locked || undefined}
                data-active={i === active}
                title={locked ? 'At least one market stays selected' : undefined}
                onMouseEnter={() => setActive(i)}
                onClick={() => toggle(m.code)}
              >
                <span className="picker-sym">
                  <MarketIcon code={m.code} size={22} />
                  {m.name}
                </span>
                <span className="picker-meta">{meta(m.code)}</span>
                <span className="picker-check">
                  <CheckIcon />
                </span>
              </li>,
            ];
          })}
          {!results.length && <li className="picker-empty muted">Nothing matches “{query.trim()}”.</li>}
        </ul>
        <div className="picker-foot muted">
          <span className="keys">
            <kbd>↑</kbd>
            <kbd>↓</kbd> to move
          </span>
          <span className="keys">
            <kbd>Enter</kbd> to add or remove
          </span>
          <span className="right">
            {selected.length} selected
          </span>
        </div>
      </div>
    </div>
  );
}
