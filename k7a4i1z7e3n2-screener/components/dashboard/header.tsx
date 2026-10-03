'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarIcon, ChevronDown, RefreshIcon, SearchIcon } from '@/components/ui/icons';

/* ─── Relative time, computed on the client only (no hydration mismatch) ─── */
export function useRelative(iso: string | undefined) {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    if (!iso) return;
    const update = () => {
      const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
      setText(s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} d ago`);
    };
    update();
    const t = setInterval(update, 30_000);
    return () => clearInterval(t);
  }, [iso]);
  return text;
}

/* ─── Status bar: when the data was fetched, what's missing, Refresh ─── */
export function StatusBar({ fetchedAt, latestYear, missing }: { fetchedAt?: string; latestYear: number; missing: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const ago = useRelative(fetchedAt);
  return (
    <div className={`statusbar${missing.length ? ' is-partial' : ''}`} role="status">
      <i aria-hidden="true" />
      <p>
        {missing.length
          ? `Some series didn't load (${missing.join(', ')}). The rest is shown.`
          : `World Bank data loaded${ago ? ` ${ago}` : ''}. Annual series, latest year ${latestYear}.`}
      </p>
      <button type="button" className="btn" onClick={() => start(() => router.refresh())} disabled={pending} aria-busy={pending}>
        <RefreshIcon className={pending ? 'spin' : undefined} />
        {pending ? 'Refreshing' : 'Refresh'}
      </button>
    </div>
  );
}

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/* ─── Top bar: wordmark + market switcher ─── */
export function TopBar({ count, onPick }: { count: number; onPick: () => void }) {
  const [mac, setMac] = useState(true);
  useEffect(() => setMac(isMac()), []);
  return (
    <nav className="topbar" aria-label="Screener">
      <a href="/" className="wordmark" aria-label="Kaizen Screener home">
        <b>Kaizen</b>
        <span>Screener</span>
      </a>
      <div className="topbar-actions">
        <button type="button" className="btn" onClick={onPick} aria-haspopup="dialog">
          <SearchIcon />
          Markets
          <span className="count">{count}</span>
          <kbd className="kbd-hint">{mac ? '⌘K' : 'Ctrl K'}</kbd>
        </button>
      </div>
    </nav>
  );
}

/* ─── Timeframe: segmented presets + a Custom range popover ─── */
type Period = number | 'MAX' | 'CUSTOM';
export function Timeframe({
  period,
  periods,
  onSelect,
  rangeStart,
  rangeEnd,
  allYears,
  draft,
  onDraftOpen,
  onPickPart,
  rangeIsValid,
}: {
  period: Period;
  periods: ReadonlyArray<number | 'MAX'>;
  onSelect: (p: number | 'MAX') => void;
  rangeStart: number;
  rangeEnd: number;
  allYears: number[];
  draft: { start: string; end: string };
  onDraftOpen: () => void;
  onPickPart: (part: 'start' | 'end', value: string) => void;
  rangeIsValid: boolean;
}) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => anchor.current && !anchor.current.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div className="controls" role="group" aria-label="Time range">
      <div className="seg" role="group" aria-label="Preset ranges">
        {periods.map(p => (
          <button key={p} type="button" aria-pressed={period === p} onClick={() => { onSelect(p); setOpen(false); }}>
            {p === 'MAX' ? 'Max' : `${p}Y`}
          </button>
        ))}
      </div>
      <div className="pop-anchor" ref={anchor}>
        <button
          type="button"
          className="btn btn-sm"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-pressed={period === 'CUSTOM'}
          onClick={() => { if (!open) onDraftOpen(); setOpen(o => !o); }}
        >
          <CalendarIcon />
          {period === 'CUSTOM' ? `${rangeStart}–${rangeEnd}` : 'Custom range'}
          <ChevronDown className="chev" />
        </button>
        {open && (
          <div className="pop" role="dialog" aria-label="Custom range">
            <div className="pop-title">
              <span>Custom range</span>
              <b>{rangeStart}–{rangeEnd}</b>
            </div>
            <div className="pop-fields">
              <label>
                From
                <select className="select" value={draft.start || String(rangeStart)} onChange={e => onPickPart('start', e.target.value)}>
                  {allYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
              <span>–</span>
              <label>
                To
                <select className="select" value={draft.end || String(rangeEnd)} onChange={e => onPickPart('end', e.target.value)}>
                  {allYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </label>
            </div>
            {!rangeIsValid && <p className="pop-error" role="alert">The end year has to be on or after the start year.</p>}
            <p className="pop-foot muted">Data runs {allYears[0]}–{allYears.at(-1)}. The chart updates as you pick.</p>
          </div>
        )}
      </div>
      <span className="controls-label">Annual data · {rangeStart}–{rangeEnd}</span>
    </div>
  );
}
