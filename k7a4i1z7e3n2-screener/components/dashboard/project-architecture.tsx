'use client';

import { useState } from 'react';
import { ChevronDown } from '@/components/ui/icons';

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
  const [showAll, setShowAll] = useState(false);
  const phases = showAll ? ROADMAP : ROADMAP.slice(-6);

  return (
    <section className="card section" aria-labelledby="build-title">
      <div className="card-head">
        <div>
          <h2 id="build-title">How it’s built</h2>
          <p>Eight engines, each with one job, feed the chart in order. Data in, readings out; none of them reach back up the chain.</p>
        </div>
      </div>

      <ol className="pipeline">
        {ENGINES.map(engine => (
          <li key={engine.name}>
            <b>{engine.name}</b>
            <span>{engine.desc}</span>
          </li>
        ))}
      </ol>

      <div className="meter-top">
        <span>Roadmap</span>
        <span>
          <b>{completed}</b>/{ROADMAP.length} phases done
        </span>
      </div>
      <div className="meter-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Roadmap progress">
        <i style={{ width: `${pct}%` }} />
      </div>

      <ul className="checks">
        {phases.map(item => {
          const done = item.status === 'completed';
          return (
            <li key={item.phase} className={`${done ? 'ok' : 'info'} fade-in`}>
              <span className="check-icon" aria-hidden="true">{done ? '✓' : '·'}</span>
              <span className="check-label">{item.phase}</span>
              <span>
                {item.title}
                {!done && <span className="muted"> · planned</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <button type="button" className="more" aria-expanded={showAll} onClick={() => setShowAll(v => !v)}>
        {showAll ? 'Show recent phases only' : `Show all ${ROADMAP.length} phases`}
        <ChevronDown className="chev" />
      </button>
    </section>
  );
}
