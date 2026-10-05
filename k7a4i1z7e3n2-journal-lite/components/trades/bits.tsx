'use client';

import { ChevronRight, Crown, Target, Anchor } from 'lucide-react';
import { TYPE_LABEL, fmtR, fmtRatio, fmtRowDay, isOpen, rOf, sideOf } from '@/lib/journal';
import type { Trade, TradeType } from '@/lib/types';
import MarketIcon from '../ui/MarketIcon';

/** Real, Demo or Missed, with its colour key. */
export function TypeTag({ type }: { type: TradeType }) {
  return (
    <span className={`ttype t-${type.toLowerCase()}`}>
      <i aria-hidden="true" />
      {TYPE_LABEL[type]}
    </span>
  );
}

/** The review marks a trade carries: King, set-and-forget, would've hit TP. */
export function Marks({ t }: { t: Trade }) {
  return (
    <span className="marks">
      {t.isKing && (
        <span className="mark-chip king" title="King trade">
          <Crown aria-hidden="true" />
          <span className="visually-hidden">King trade</span>
        </span>
      )}
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
    <li style={{ '--i': i } as React.CSSProperties} className={t.tradeType === 'DEMO' ? 'is-demo' : undefined}>
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
