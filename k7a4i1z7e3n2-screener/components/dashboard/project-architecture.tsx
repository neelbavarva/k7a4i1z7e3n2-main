'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';

const ENGINES = [
  { name: 'Datasets',              desc: 'Registry & metadata',              icon: '⬡', color: '#6366f1' },
  { name: 'Analysis Engine',       desc: 'Statistical status & trends',      icon: '◈', color: '#8b5cf6' },
  { name: 'Historical Context',    desc: 'Envelope & quantile bounds',       icon: '◎', color: '#a855f7' },
  { name: 'Insight Engine',        desc: 'Rule synthesis & advice',          icon: '◆', color: '#ec4899' },
  { name: 'Historical Comparison', desc: 'Single-series alignment',          icon: '◉', color: '#f43f5e' },
  { name: 'Relationship Engine',   desc: 'Correlation & lead/lag',           icon: '◐', color: '#f97316' },
  { name: 'Scenario Engine',       desc: 'Hypothetical projections',         icon: '◑', color: '#eab308' },
  { name: 'Pattern Engine',        desc: 'Multi-variable environment match', icon: '◈', color: '#10b981' },
];

const ROADMAP = [
  { phase: 'Phase 0',   title: 'Repository Integrity Audit',                         status: 'completed' },
  { phase: 'Phase 1',   title: 'Macro Data Foundation & Recharts Base',               status: 'completed' },
  { phase: 'Phase 2',   title: 'AI Capital Flow & Valuation Intelligence',            status: 'completed' },
  { phase: 'Phase 3A',  title: 'Bubble Benchmark Integration',                        status: 'completed' },
  { phase: 'Phase 3B',  title: 'Adaptive Buffett Band Engine',                        status: 'completed' },
  { phase: 'Phase 4A',  title: 'Data Abstraction & Dataset Registry Architecture',    status: 'completed' },
  { phase: 'Phase 4B',  title: 'Dynamic Multi-Series Canvas Engine',                  status: 'completed' },
  { phase: 'Phase 5A',  title: 'Analytical Core Engine & Status Classification',      status: 'completed' },
  { phase: 'Phase 5B',  title: 'Relationship Engine (Linear, Rolling, Lead/Lag)',     status: 'completed' },
  { phase: 'Phase 5C',  title: 'Scenario Engine (Trend, Relationship, Analogue)',     status: 'completed' },
  { phase: 'Phase 5D',  title: 'Pattern Engine (Environment Matching & Analogues)',   status: 'completed' },
  { phase: 'Phase 6',   title: 'Production Polish & UX Standardization',             status: 'completed' },
  { phase: 'Version 2', title: 'UI Canvas Integration for Advanced Engines',          status: 'upcoming'  },
  { phase: 'Version 3', title: 'Interactive Workspaces & Custom Data Feeds',          status: 'upcoming'  },
];

const completed = ROADMAP.filter(r => r.status === 'completed').length;
const pct = Math.round((completed / ROADMAP.length) * 100);

export function ProjectArchitecture() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <section className="mb-3 pt-2">
      <Card className="overflow-hidden">
        {/* Toggle Header */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label="Toggle Project Architecture and Roadmap panel"
          className="flex w-full items-center justify-between px-3.5 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
          style={{ borderBottom: isOpen ? '1px solid var(--border-base)' : undefined }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-hover)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = ''; }}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-indigo-500/10">
              <span className="text-[10px] text-indigo-500">✦</span>
            </div>
            <h2 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
              Project Architecture &amp; Roadmap
            </h2>
            <span className="hidden sm:inline font-mono text-[9px] rounded-full px-2 py-0.5 bg-indigo-50 text-indigo-600 font-semibold">
              {pct}% complete
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              {isOpen ? 'Collapse' : 'Expand'}
            </span>
            <ChevronDown
              size={13}
              className="transition-transform duration-200"
              style={{ color: 'var(--text-tertiary)', transform: isOpen ? 'rotate(180deg)' : undefined }}
            />
          </div>
        </button>

        {/* Content */}
        {isOpen && (
          <div className="panel-reveal" style={{ background: 'var(--surface-subtle)' }}>

            {/* ── Engine Pipeline ── */}
            <div className="p-4 pb-3">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="section-label">Engine Pipeline Architecture</h3>
                <span className="font-mono text-[9.5px] text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">
                  Strict Layer Separation
                </span>
              </div>

              {/* Horizontal scrollable engine flow */}
              <div className="overflow-x-auto no-scrollbar pb-1">
                <div className="flex items-stretch gap-0 min-w-max">
                  {ENGINES.map((engine, idx) => (
                    <div key={engine.name} className="flex items-center">
                      <div
                        className="group relative flex flex-col rounded-md p-2.5 transition-all cursor-default w-[130px]"
                        style={{
                          border: '1px solid var(--border-base)',
                          background: 'var(--surface-card)',
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLDivElement).style.borderColor = engine.color + '50';
                          (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 0 2px ${engine.color}18`;
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLDivElement).style.borderColor = '';
                          (e.currentTarget as HTMLDivElement).style.boxShadow = '';
                        }}
                      >
                        {/* Top accent line */}
                        <div
                          className="absolute inset-x-0 top-0 h-[2px] rounded-t-md opacity-80 group-hover:opacity-100 transition-opacity"
                          style={{ background: engine.color }}
                        />
                        {/* Index */}
                        <span
                          className="font-mono text-[9px] font-bold tabular-nums"
                          style={{ color: engine.color }}
                        >
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        {/* Name */}
                        <p className="mt-1.5 text-[11px] font-semibold leading-snug text-slate-800">
                          {engine.name}
                        </p>
                        {/* Desc */}
                        <p className="mt-0.5 text-[9.5px] leading-snug text-slate-400">
                          {engine.desc}
                        </p>
                      </div>
                      {/* Connector arrow */}
                      {idx < ENGINES.length - 1 && (
                        <div className="flex items-center px-1 shrink-0">
                          <div className="h-px w-3 bg-slate-200" />
                          <svg width="5" height="8" viewBox="0 0 5 8" fill="none" className="text-slate-300" aria-hidden>
                            <path d="M0.5 0.5L4.5 4L0.5 7.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Roadmap ── */}
            <div className="border-t border-slate-100 p-4 pt-3">
              {/* Header with progress */}
              <div className="mb-2.5 flex items-center justify-between">
                <h3 className="section-label">Project Roadmap</h3>
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-1.5">
                    <div className="h-1 w-24 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="font-mono text-[9px] text-slate-400">{completed}/{ROADMAP.length}</span>
                  </div>
                  <span className="font-mono text-[9.5px] text-slate-400">Phase 0 → v3</span>
                </div>
              </div>

              {/* Timeline grid */}
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {ROADMAP.map((item, idx) => {
                  const done = item.status === 'completed';
                  return (
                    <div
                      key={item.phase}
                      className="flex items-start gap-2.5 rounded-md px-2.5 py-2 transition-colors"
                      style={{
                        border: done
                          ? '1px solid var(--border-base)'
                          : '1px dashed rgba(99,102,241,0.25)',
                        background: done ? 'var(--surface-card)' : 'rgba(99,102,241,0.02)',
                      }}
                    >
                      {/* Step indicator */}
                      <div className="flex flex-col items-center gap-0.5 shrink-0 pt-0.5">
                        <div
                          className={`h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-bold transition-all ${
                            done
                              ? 'bg-indigo-500 text-white'
                              : 'border border-indigo-300 text-indigo-300 bg-white'
                          }`}
                        >
                          {done ? '✓' : String(idx + 1)}
                        </div>
                      </div>
                      {/* Content */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="font-mono text-[9.5px] font-semibold"
                            style={{ color: done ? '#6366f1' : 'var(--text-tertiary)' }}
                          >
                            {item.phase}
                          </span>
                          {!done && (
                            <span
                              className="rounded px-1 py-px font-mono text-[8.5px] font-medium"
                              style={{ background: 'rgba(99,102,241,0.08)', color: '#a5b4fc' }}
                            >
                              Planned
                            </span>
                          )}
                        </div>
                        <p
                          className="mt-0.5 text-[10.5px] leading-snug font-medium"
                          style={{ color: done ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}
                        >
                          {item.title}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}
      </Card>
    </section>
  );
}
