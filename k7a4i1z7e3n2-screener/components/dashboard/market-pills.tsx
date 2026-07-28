'use client';

import { X } from 'lucide-react';
import { RESEARCH_MARKETS } from '@/lib/worldbank/client';

const accents: Record<string, string> = {
  US: '#3b82f6', IN: '#f97316', CN: '#e11d48', RU: '#a855f7',
  JP: '#ec4899', GB: '#06b6d4', WLD: '#14b8a6', Z7E: '#6366f1',
  Z4E: '#10b981', SAS: '#84cc16', LCN: '#c084fc', MEA: '#f59e0b', SSF: '#a16207',
};
const palette = ['#3b82f6', '#f97316', '#10b981', '#a855f7', '#e11d48', '#06b6d4', '#f59e0b', '#ec4899'];
const colorFor = (code: string, index = 0) => accents[code] ?? palette[index % palette.length];
const marketName = (code: string) => RESEARCH_MARKETS.find(([id]) => id === code)?.[1] ?? code;

interface MarketPillsProps {
  selectedMarkets: string[];
  onToggleMarket: (code: string) => void;
}

export function MarketPills({ selectedMarkets, onToggleMarket }: MarketPillsProps) {
  return (
    <section className="py-1.5 sm:py-2" aria-label="Selected markets filter strip">
      <div
        className="flex items-center gap-2 overflow-x-auto no-scrollbar rounded-lg px-3 py-2"
        style={{
          background: 'var(--surface-subtle)',
          border: '1px solid var(--border-base)',
        }}
      >
        <span className="section-label shrink-0 mr-1 hidden sm:inline-block">Active:</span>
        {selectedMarkets.map((code, index) => {
          const color = colorFor(code, index);
          const canRemove = selectedMarkets.length > 1;

          return (
            <div
              key={code}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full py-1 pl-2.5 pr-1.5 text-[11px] font-medium transition-all"
              style={{
                background: 'var(--surface-card)',
                border: '1px solid var(--border-base)',
                color: 'var(--text-primary)',
                boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
              }}
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              <span className="font-medium">{marketName(code)}</span>
              {canRemove && (
                <button
                  type="button"
                  onClick={() => onToggleMarket(code)}
                  className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none"
                  style={{ color: 'var(--text-tertiary)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'; (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-subtle)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-tertiary)'; (e.currentTarget as HTMLButtonElement).style.background = ''; }}
                  aria-label={`Remove ${marketName(code)} market`}
                  title={`Remove ${marketName(code)}`}
                >
                  <X size={10} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
