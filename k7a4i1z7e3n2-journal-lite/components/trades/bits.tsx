'use client';

import { ChevronRight, Rabbit, Snail, Target, Anchor } from 'lucide-react';
import { TYPE_LABEL, fmtR, fmtRatio, fmtRowDay, isOpen, rOf, sideOf } from '@/lib/journal';
import { ON_PACE, PACE_LABEL, paceKey, paceOf, type Pace, type PaceOrNone } from '@/lib/pace';
import type { Trade, TradeType } from '@/lib/types';
import MarketIcon from '../ui/MarketIcon';
import Seg from '../ui/Seg';

/** Rushing is a hare, dragging a snail. */
export function PaceIcon({ pace }: { pace: Pace }) {
  return pace === 'RUSHING' ? <Rabbit aria-hidden="true" /> : <Snail aria-hidden="true" />;
}

/** A trade's pace in its colour: orange for rushing, violet for dragging, quiet for on pace. */
export function PaceTag({ pace, compact }: { pace: PaceOrNone; compact?: boolean }) {
  const label = pace ? PACE_LABEL[pace] : ON_PACE;
  if (compact) {
    if (!pace) return null;
    return (
      <span className={`mark-chip pace p-${paceKey(pace)}`} title={label}>
        <PaceIcon pace={pace} />
        <span className="visually-hidden">{label}</span>
      </span>
    );
  }
  return (
    <span className={`pace-tag p-${paceKey(pace)}`}>
      {pace ? <PaceIcon pace={pace} /> : <i aria-hidden="true" />}
      {label}
    </span>
  );
}

/** Real, Demo or Missed, with its colour key. */
export function TypeTag({ type }: { type: TradeType }) {
  return (
    <span className={`ttype t-${type.toLowerCase()}`}>
      <i aria-hidden="true" />
      {TYPE_LABEL[type]}
    </span>
  );
}

/** On pace, rushing or dragging: the switch on a new trade and in a trade's review. */
export function PaceSeg({ value, onChange, disabled, wide }: { value: PaceOrNone; onChange: (p: PaceOrNone) => void; disabled?: boolean; wide?: boolean }) {
  return (
    <Seg<'NONE' | Pace>
      label="Pace"
      wide={wide}
      className="pace-seg"
      value={value ?? 'NONE'}
      onChange={(v) => onChange(v === 'NONE' ? null : v)}
      options={[
        { value: 'NONE', label: ON_PACE, className: 'p-none', disabled },
        { value: 'RUSHING', label: PACE_LABEL.RUSHING, icon: <Rabbit aria-hidden="true" />, className: 'p-rushing', disabled },
        { value: 'DRAGGING', label: PACE_LABEL.DRAGGING, icon: <Snail aria-hidden="true" />, className: 'p-dragging', disabled },
      ]}
    />
  );
}

/** The marks a trade carries: its pace (when it isn't on pace), set-and-forget, would've hit TP. */
export function Marks({ t, pace = true }: { t: Trade; pace?: boolean }) {
  return (
    <span className="marks">
      {pace && <PaceTag pace={paceOf(t)} compact />}
      {t.setForgetDecided && t.setForget && (
        <span className="mark-chip sf" title="Set and forget">
          <Anchor aria-hidden="true" />
          <span className="visually-hidden">Set and forget</span>
        </span>
      )}
      {t.sabotagedWinner && (
        <span className="mark-chip sab" title="Would’ve hit TP">
          <Target aria-hidden="true" />
          <span className="visually-hidden">Would’ve hit TP</span>
        </span>
      )}
    </span>
  );
}

export function Result({ t }: { t: Trade }) {
  if (isOpen(t)) return <span className="open-tag">Open</span>;
  const r = rOf(t);
  return <span className={`pnl ${sideOf(r)}`}>{fmtR(r)}</span>;
}

export function TradeRow({ t, i, onOpen }: { t: Trade; i: number; onOpen: () => void }) {
  return (
    <li style={{ '--i': i } as React.CSSProperties} className={t.tradeType === 'DEMO' ? 'is-demo' : undefined} data-pace={paceKey(paceOf(t))}>
      <button type="button" className="row-btn jrow" onClick={onOpen}>
        <span className="row-main">
          <MarketIcon symbol={t.pair} size={26} />
          <span className="row-text">
            <span className="row-title">
              {t.pair}
              <Marks t={t} />
            </span>
            <span className="row-sub">{t.description || 'No notes'}</span>
          </span>
        </span>
        <span className="row-meta col-date">{fmtRowDay(t.createdAt)}</span>
        <span className="col-type">
          <TypeTag type={t.tradeType} />
        </span>
        <span className="row-num row-meta col-rr">{fmtRatio(t.riskRatio)}</span>
        <span className="row-num col-pnl">
          <Result t={t} />
        </span>
        <span className="col-meta" aria-hidden="true">
          <TypeTag type={t.tradeType} />
          <span>{fmtRowDay(t.createdAt)}</span>
          <span>{fmtRatio(t.riskRatio)}</span>
        </span>
        <ChevronRight className="row-go" aria-hidden="true" />
      </button>
    </li>
  );
}
