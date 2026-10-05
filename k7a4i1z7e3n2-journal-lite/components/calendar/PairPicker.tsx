'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Layers, Search } from 'lucide-react';
import Modal from '../ui/Modal';
import MarketIcon from '../ui/MarketIcon';

/** Command-palette pair picker, as in the vault journal: type to filter, arrows and Enter to pick. */
export default function PairPicker({
  open,
  onClose,
  pairs,
  counts,
  value,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  pairs: string[];
  counts: Record<string, number>;
  value: string;
  onPick: (pair: string) => void;
}) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setActive(0);
    }
  }, [open]);

  const options = useMemo(() => {
    const needle = q.trim().toUpperCase().replace(/[\s/]/g, '');
    const hits = pairs.filter((p) => p.replace('/', '').includes(needle));
    return needle ? hits : ['', ...hits];
  }, [pairs, q]);

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
          placeholder="Find a pair"
          aria-label="Find a pair"
          role="combobox"
          aria-expanded="true"
          aria-controls="pair-list"
          aria-activedescendant={`pair-opt-${active}`}
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
              {p ? counts[p] || 0 : counts[''] || 0}
              {p === value && <Check aria-hidden="true" />}
            </span>
          </li>
        ))}
        {!options.length && <li className="picker-empty muted">No pair matches “{q}”.</li>}
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
