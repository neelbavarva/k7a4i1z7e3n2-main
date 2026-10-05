'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Layers, Search } from 'lucide-react';
import { findPairs } from '@/lib/pairs';
import Modal from './Modal';
import MarketIcon from './MarketIcon';

/**
 * Command-palette pair picker, as in the vault journal: type to filter (gold, silver, bitcoin and
 * ethereum work too), arrows and Enter to pick. `withAll` puts an "All pairs" row on top, picked
 * as ''; `counts` shows a number beside each pair; `seed` is what the search starts with.
 */
export default function PairPicker({
  open,
  onClose,
  pairs,
  value,
  onPick,
  counts,
  withAll = false,
  seed = '',
}: {
  open: boolean;
  onClose: () => void;
  pairs: readonly string[];
  value: string;
  onPick: (pair: string) => void;
  counts?: Record<string, number>;
  withAll?: boolean;
  seed?: string;
}) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (open) {
      setQ(seed);
      setActive(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const options = useMemo(() => {
    const hits = findPairs(pairs, q);
    return withAll && !q.trim() ? ['', ...hits] : hits;
  }, [pairs, q, withAll]);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const pick = (p: string) => {
    onPick(p);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} className="picker" head={false} label="Pick a pair">
      <div className="picker-search">
        <Search aria-hidden="true" />
        <input
          data-autofocus
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, options.length - 1));
            else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
            else if (e.key === 'Enter' && options[active] !== undefined) pick(options[active]);
            else return;
            e.preventDefault();
          }}
          placeholder="Find a pair: EURUSD, gbp, gold…"
          aria-label="Find a pair"
          role="combobox"
          aria-expanded="true"
          aria-controls="pair-list"
          aria-activedescendant={options.length ? `pair-opt-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
        />
        <kbd>Esc</kbd>
      </div>
      <ul className="picker-list" id="pair-list" role="listbox" ref={list}>
        {options.map((p, i) => (
          <li
            key={p || 'all'}
            id={`pair-opt-${i}`}
            role="option"
            aria-selected={p === value}
            data-active={i === active}
            onMouseMove={() => setActive(i)}
            onClick={() => pick(p)}
          >
            <span className="picker-sym">
              {p ? (
                <MarketIcon symbol={p} size={20} />
              ) : (
                <span className="all-icon" aria-hidden="true">
                  <Layers />
                </span>
              )}
              {p || 'All pairs'}
            </span>
            <span className="picker-right">
              {counts && (counts[p] || 0)}
              {p === value && <Check aria-hidden="true" />}
            </span>
          </li>
        ))}
        {!options.length && <li className="picker-empty muted">No pair matches “{q.trim()}”.</li>}
      </ul>
      <div className="picker-foot" aria-hidden="true">
        <span>
          <kbd>↑</kbd>
          <kbd>↓</kbd>move
        </span>
        <span>
          <kbd>Enter</kbd>pick
        </span>
      </div>
    </Modal>
  );
}
