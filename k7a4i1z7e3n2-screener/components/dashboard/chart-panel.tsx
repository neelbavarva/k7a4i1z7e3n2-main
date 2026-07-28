'use client';

import { useState } from 'react';
import { Maximize2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Chart } from './chart';

interface ChartPanelProps {
  title: string;
  subtitle: string;
  option: Record<string, unknown>;
  height?: string;
  toolbar?: React.ReactNode;
  legend?: React.ReactNode;
}

export function ChartPanel({ title, subtitle, option, height, toolbar, legend }: ChartPanelProps) {
  const [open, setOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [expandedResetKey, setExpandedResetKey] = useState(0);

  return (
    <>
      <Card elevation="raised" className="soft-enter overflow-hidden">
        {/* Card header */}
        <div className="flex flex-col gap-2 border-b border-slate-100 p-2 sm:flex-row sm:items-center sm:justify-between sm:px-3 sm:py-1.5">
          <div className="min-w-0">
            <h2 className="text-[12px] font-semibold text-slate-800">{title}</h2>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
            {toolbar && (
              <div className="flex-1 min-w-0 overflow-x-auto no-scrollbar">
                {toolbar}
              </div>
            )}
            <div className="flex items-center gap-1.5 shrink-0 ml-auto sm:ml-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setResetKey(k => k + 1)}
                className="h-7 shrink-0 px-2 font-mono text-[10.5px] gap-1"
                title="Reset chart zoom"
                aria-label="Reset chart zoom"
              >
                <RotateCcw size={11} className="shrink-0 text-slate-500" />
                <span>Reset</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(true)}
                className="h-7 shrink-0 px-2 font-mono text-[10.5px] gap-1"
                aria-label={`Expand ${title} chart`}
              >
                <Maximize2 size={11} className="shrink-0 text-slate-500" />
                <span>Expand</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Legend */}
        {legend && (
          <div className="p-2 sm:px-3 sm:py-1.5" style={{ borderBottom: '1px solid var(--border-base)', background: 'var(--surface-subtle)' }}>
            {legend}
          </div>
        )}

        {/* Chart */}
        <div className="p-1" role="img" aria-label={`${title} chart`}>
          <Chart
            option={option}
            className={height ?? 'h-[360px] sm:h-[480px] md:h-[620px]'}
            resetKey={resetKey}
          />
        </div>
      </Card>

      {/* Fullscreen dialog */}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={title}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setExpandedResetKey(k => k + 1)}
            className="h-7 shrink-0 px-2 text-[11px] font-mono"
            aria-label="Reset expanded chart zoom"
          >
            Reset
          </Button>
        }
      >
        <div role="img" aria-label={`${title} expanded chart`}>
          <Chart option={option} className="h-[calc(100dvh-72px)]" resetKey={expandedResetKey} />
        </div>
      </Dialog>
    </>
  );
}
