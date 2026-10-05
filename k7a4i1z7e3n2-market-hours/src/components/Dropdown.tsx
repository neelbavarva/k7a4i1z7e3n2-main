import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

export interface DropdownOption {
  value: string;
  /** "EURUSD", "USD" */
  label: string;
  /** "Euro / US Dollar" */
  sub?: string;
  /** a heading the option sits under while the list isn't searched */
  group?: string;
  /** on the right of the row: a price */
  aside?: ReactNode;
}

interface Props {
  /** the field's visible label */
  labelId: string;
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  /** narrows the list for a search; by default the label or name contains the text */
  search?: (query: string) => DropdownOption[];
  placeholder?: string;
  /** on the right of the closed field */
  aside?: ReactNode;
  /** to open it from outside (a keyboard shortcut) */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const coarse = () => {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
};

/**
 * A select with a search box, like Myfxbook's pair list: the field opens a panel with a search
 * at the top and the options under it. Type to narrow, arrows to move, Enter to choose, Esc or a
 * click outside to close. Opens upwards when there's no room below.
 */
export default function Dropdown({ labelId, value, options, onChange, search, placeholder = 'Search…', aside, ...props }: Props) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = props.open ?? ownOpen;
  const onOpenChange = useRef(props.onOpenChange);
  onOpenChange.current = props.onOpenChange;
  const setOpen = (v: boolean) => {
    setOwnOpen(v);
    onOpenChange.current?.(v);
  };

  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [up, setUp] = useState(false);
  const [room, setRoom] = useState(290);
  const typed = useRef('');
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();

  const selected = options.find((o) => o.value === value);
  const q = query.trim();
  const results = useMemo(() => {
    if (!q) return options;
    if (search) return search(q);
    const t = q.toLowerCase();
    return options.filter((o) => `${o.label} ${o.sub ?? ''}`.toLowerCase().includes(t));
  }, [q, options, search]);

  // on opening: start on the chosen option (or what was typed on the field), with the search in focus
  useLayoutEffect(() => {
    if (!open) return;
    setQuery(typed.current);
    typed.current = '';
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    const t = trigger.current;
    if (t) {
      t.scrollIntoView({ block: 'nearest' });
      // open towards the bigger space, and never taller than it (the search box takes about 60px)
      const r = t.getBoundingClientRect();
      const below = window.innerHeight - r.bottom;
      const goUp = below < 340 && r.top > below;
      setUp(goUp);
      setRoom(Math.max(120, Math.min(290, (goUp ? r.top : below) - 76)));
    }
    // on phones, don't throw the keyboard over the list until they tap the search
    if (!coarse()) input.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open) list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active, open, results]);

  const choose = (o: DropdownOption | undefined) => {
    if (!o) return;
    onChange(o.value);
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  };

  const onTriggerKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
    } else if (e.key.length === 1 && e.key !== '/' && e.key !== ' ' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      // typing on the closed field starts a search
      e.preventDefault();
      typed.current = e.key;
      setOpen(true);
    }
  };

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'PageDown' || e.key === 'PageUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, Math.min(results.length - 1, i + (e.key === 'PageDown' ? 8 : -8))));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      trigger.current?.focus({ preventScroll: true });
    } else if (e.key === 'Tab') {
      setOpen(false);
    }
  };

  return (
    <div className={`dd${open ? ' is-open' : ''}${up ? ' is-up' : ''}`} ref={root}>
      <button
        type="button"
        ref={trigger}
        className="input-wrap dd-field"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${labelId} ${id}-value`}
        onClick={() => setOpen(!open)}
        onKeyDown={onTriggerKey}
      >
        <span className="dd-value" id={`${id}-value`}>
          <b>{selected?.label ?? value}</b>
          {selected?.sub && <span className="dd-sub"> – {selected.sub}</span>}
        </span>
        {aside && <span className="dd-aside">{aside}</span>}
        <span className="dd-chevron" aria-hidden="true" />
      </button>

      {open && (
        <div className="dd-panel">
          <div className="dd-search">
            <input
              ref={input}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onSearchKey}
              role="combobox"
              aria-expanded="true"
              aria-controls={`${id}-list`}
              aria-activedescendant={results[active] ? `${id}-${active}` : undefined}
              aria-label="Search"
              placeholder={placeholder}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <ul className="dd-list" id={`${id}-list`} role="listbox" aria-labelledby={labelId} ref={list} style={{ maxHeight: room }}>
            {results.map((o, i) => (
              <Fragment key={o.value}>
                {!q && o.group && (i === 0 || results[i - 1].group !== o.group) && (
                  <li role="presentation" className="dd-group">
                    {o.group}
                  </li>
                )}
                <li
                  id={`${id}-${i}`}
                  role="option"
                  aria-selected={o.value === value}
                  data-active={i === active}
                  onMouseMove={() => i !== active && setActive(i)}
                  onClick={() => choose(o)}
                >
                  <span className="dd-option">
                    <b>{o.label}</b>
                    {o.sub && <span className="dd-sub"> – {o.sub}</span>}
                  </span>
                  {o.aside && <span className="dd-aside">{o.aside}</span>}
                </li>
              </Fragment>
            ))}
            {!results.length && <li className="dd-empty">Nothing matches “{q}”.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
