'use client';

import { useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { ExpandIcon, ResetIcon } from '@/components/ui/icons';
import { Chart } from './chart';

interface ChartPanelProps {
  viewKey: string;
  title: string;
  subtitle: string;
  option: Record<string, unknown>;
  short?: boolean;
  toolbar?: React.ReactNode;
  legend?: React.ReactNode;
  foot?: React.ReactNode;
  empty?: React.ReactNode;
}

/** The main chart card: serif title, view switcher, legend, chart, reading note. */
export function ChartPanel({ viewKey, title, subtitle, option, short, toolbar, legend, foot, empty }: ChartPanelProps) {
  const [open, setOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [expandedResetKey, setExpandedResetKey] = useState(0);

  return (
    <section className="card section" aria-labelledby="chart-title">
      <div className="card-head">
        <div key={`h-${viewKey}`} className="swap">
          <h2 id="chart-title">{title}</h2>
          <p>{subtitle}</p>
        </div>
        {!empty && (
          <div className="card-tools">
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setResetKey(k => k + 1)} title="Reset zoom and position">
              <ResetIcon />
              Reset
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setOpen(true)} aria-label={`Expand ${title} chart`}>
              <ExpandIcon />
              Expand
            </button>
          </div>
        )}
      </div>

      {toolbar && <div style={{ marginTop: 16 }}>{toolbar}</div>}

      {empty ? (
        <div className="empty swap">{empty}</div>
      ) : (
        <>
          {legend}
          <div key={viewKey} className="chart-wrap swap" role="img" aria-label={`${title} chart`}>
            <Chart option={option} className={`chart-h${short ? ' is-short' : ''}`} resetKey={resetKey} />
          </div>
        </>
      )}

      {foot && <div className="chart-foot">{foot}</div>}

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        subtitle={subtitle}
        actions={
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setExpandedResetKey(k => k + 1)}>
            <ResetIcon />
            Reset
          </button>
        }
      >
        {legend}
        <div role="img" aria-label={`${title} expanded chart`} className="sheet-chart">
          <Chart option={option} className="chart-h-fill" resetKey={expandedResetKey} />
        </div>
      </Dialog>
    </section>
  );
}
