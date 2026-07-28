'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { BubbleDataset } from '@/types/bubbles';
import { Card } from '@/components/ui/card';

const display = (value: number | null, suffix = '') => value === null ? '—' : `${value}${suffix}`;

export function BubbleLibrary({ bubbles }: { bubbles: BubbleDataset[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="py-1.5 sm:py-2">
      <Card className="overflow-hidden">
        {/* Collapsible Header */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label="Toggle Historical bubble library panel"
          className="flex w-full items-center justify-between px-3.5 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          style={{
            borderBottom: isOpen ? '1px solid var(--border-base)' : undefined,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-hover)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = ''; }}
        >
          <div className="flex items-center gap-2">
            <span className="section-label">Historical bubble library</span>
            <span className="count-chip">{bubbles.length}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              {isOpen ? 'Collapse' : 'Expand'}
            </span>
            <ChevronDown
              size={13}
              className={`transition-transform duration-200`}
              style={{ color: 'var(--text-tertiary)', transform: isOpen ? 'rotate(180deg)' : undefined }}
            />
          </div>
        </button>

        {/* Collapsible Content */}
        {isOpen && (
          <div className="panel-reveal">
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full min-w-[880px] border-collapse text-left">
                <thead className="section-label" style={{ borderBottom: '1px solid var(--border-base)', background: 'var(--surface-subtle)' }}>
                  <tr>
                    <th className="px-3.5 py-2.5 font-medium">Episode</th>
                    <th className="px-3.5 py-2.5 font-medium">Timeline</th>
                    <th className="px-3.5 py-2.5 font-medium">Peak reference</th>
                    <th className="px-3.5 py-2.5 font-medium">Largest drawdown</th>
                    <th className="px-3.5 py-2.5 font-medium">Recovery</th>
                    <th className="px-3.5 py-2.5 font-medium">Key trigger</th>
                  </tr>
                </thead>
                <tbody>
                  {bubbles.map(bubble => (
                    <tr key={bubble.id} className="table-row-hover last:border-0 align-top"
                      style={{ borderBottom: '1px solid var(--border-base)' }}
                    >
                      <td className="px-3.5 py-2.5">
                        <p className="text-xs font-semibold text-slate-800">{bubble.name}</p>
                        <p className="mt-0.5 font-mono text-[10px] text-slate-400">{bubble.benchmark}</p>
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-[11px] text-slate-700">
                        {display(bubble.startYear)} → {display(bubble.peakYear)} → {display(bubble.crashYear)}
                      </td>
                      <td className="max-w-48 px-3.5 py-2.5 text-[11px] text-slate-700">{bubble.peakValuation ?? '—'}</td>
                      <td className="px-3.5 py-2.5 font-mono text-[11px] text-slate-700">
                        {bubble.largestDrawdownPercent === null ? '—' : `${bubble.largestDrawdownPercent.toFixed(2)}%`}
                      </td>
                      <td className="px-3.5 py-2.5 font-mono text-[11px] text-slate-700">
                        {bubble.recoveryYear === null ? '—' : `${bubble.recoveryYear}${bubble.recoveryTimeYears === null ? '' : ` · ${bubble.recoveryTimeYears}y`}`}
                      </td>
                      <td className="max-w-64 px-3.5 py-2.5 text-[11px] leading-4 text-slate-600">{bubble.mainTrigger}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ borderTop: '1px solid var(--border-base)' }}>
              {bubbles.map(bubble => (
                <details key={bubble.id} className="group" style={{ borderBottom: '1px solid var(--border-base)' }}>
                  <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-2.5 text-xs font-semibold transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-hover)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
                  >
                    <span>{bubble.name} · research notes & sources</span>
                    <span className="font-mono text-[11px] group-open:hidden" style={{ color: 'var(--text-tertiary)' }}>+</span>
                    <span className="hidden font-mono text-[11px] group-open:block" style={{ color: 'var(--text-tertiary)' }}>×</span>
                  </summary>
                  <div className="grid gap-3 px-3.5 py-3.5 text-[11px] leading-5 md:grid-cols-2"
                    style={{ borderTop: '1px solid var(--border-base)', background: 'var(--surface-subtle)', color: 'var(--text-secondary)' }}
                  >
                    <div>
                      <p><span className="font-semibold text-slate-800">Summary:</span> {bubble.historicalSummary}</p>
                      <p className="mt-2"><span className="font-semibold text-slate-800">Main cause:</span> {bubble.mainCause}</p>
                      <p className="mt-2"><span className="font-semibold text-slate-800">Capital inflow:</span> {bubble.capitalInflow ?? 'Not stated where a reliable aggregate was not available.'}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">Major events</p>
                      <ul className="mt-1 space-y-1">
                        {bubble.timeline.map(event => (
                          <li key={`${bubble.id}-${event.year}-${event.title}`}>
                            <span className="font-mono text-slate-400">{event.year}</span> · <span className="font-medium text-slate-700">{event.title}:</span> {event.detail}
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 font-semibold text-slate-800">Key lessons</p>
                      <ul className="mt-1 space-y-1">
                        {bubble.keyLessons.map(lesson => <li key={lesson}>• {lesson}</li>)}
                      </ul>
                    </div>
                    <div className="md:col-span-2">
                      <p className="font-semibold text-slate-800">Sources</p>
                      <ul className="mt-1 space-y-1">
                        {bubble.sources.map(source => (
                          <li key={source.url}>
                            <a className="underline text-indigo-600" href={source.url} target="_blank" rel="noreferrer">{source.name}</a>{' '}
                            <span className="text-slate-400">· {source.organization}{source.note ? ` · ${source.note}` : ''}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-slate-500">
                        <span className="font-semibold text-slate-700">Limitations:</span> {bubble.limitations.join(' ')}
                      </p>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}
      </Card>
    </section>
  );
}
