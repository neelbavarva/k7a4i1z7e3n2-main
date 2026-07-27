import type { BubbleDataset } from '@/types/bubbles';
import { Card } from '@/components/ui/card';

const display = (value: number | null, suffix = '') => value === null ? '—' : `${value}${suffix}`;

export function BubbleLibrary({ bubbles }: { bubbles: BubbleDataset[] }) {
  return <section className="py-2">
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <p className="font-mono text-[10px] uppercase tracking-[.1em] text-slate-500">Historical bubble library</p>
        <span className="font-mono text-[10px] text-slate-400">static reference datasets</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] border-collapse text-left">
          <thead className="border-b border-slate-100 bg-slate-50/60 font-mono text-[10px] uppercase tracking-[.07em] text-slate-400">
            <tr><th className="px-3 py-2 font-medium">Episode</th><th className="px-3 py-2 font-medium">Timeline</th><th className="px-3 py-2 font-medium">Peak reference</th><th className="px-3 py-2 font-medium">Largest drawdown</th><th className="px-3 py-2 font-medium">Recovery</th><th className="px-3 py-2 font-medium">Key trigger</th></tr>
          </thead>
          <tbody>{bubbles.map(bubble => <tr key={bubble.id} className="border-b border-slate-100 last:border-0 align-top hover:bg-slate-50/70">
            <td className="px-3 py-2"><p className="text-xs font-semibold text-slate-800">{bubble.name}</p><p className="mt-0.5 font-mono text-[10px] text-slate-400">{bubble.benchmark}</p></td>
            <td className="px-3 py-2 font-mono text-[11px] text-slate-700">{display(bubble.startYear)} → {display(bubble.peakYear)} → {display(bubble.crashYear)}</td>
            <td className="max-w-48 px-3 py-2 text-[11px] text-slate-700">{bubble.peakValuation ?? '—'}</td>
            <td className="px-3 py-2 font-mono text-[11px] text-slate-700">{bubble.largestDrawdownPercent === null ? '—' : `${bubble.largestDrawdownPercent.toFixed(2)}%`}</td>
            <td className="px-3 py-2 font-mono text-[11px] text-slate-700">{bubble.recoveryYear === null ? '—' : `${bubble.recoveryYear}${bubble.recoveryTimeYears === null ? '' : ` · ${bubble.recoveryTimeYears}y`}`}</td>
            <td className="max-w-64 px-3 py-2 text-[11px] leading-4 text-slate-600">{bubble.mainTrigger}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="border-t border-slate-100">
        {bubbles.map(bubble => <details key={bubble.id} className="group border-b border-slate-100 last:border-0">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-semibold text-slate-700 marker:content-none"><span>{bubble.name} · research notes & sources</span><span className="font-mono text-[11px] text-slate-400 group-open:hidden">+</span><span className="hidden font-mono text-[11px] text-slate-400 group-open:block">×</span></summary>
          <div className="grid gap-3 border-t border-slate-100 bg-slate-50/40 px-3 py-3 text-[11px] leading-5 text-slate-600 md:grid-cols-2">
            <div><p><span className="font-semibold text-slate-800">Summary:</span> {bubble.historicalSummary}</p><p className="mt-2"><span className="font-semibold text-slate-800">Main cause:</span> {bubble.mainCause}</p><p className="mt-2"><span className="font-semibold text-slate-800">Capital inflow:</span> {bubble.capitalInflow ?? 'Not stated where a reliable aggregate was not available.'}</p></div>
            <div><p className="font-semibold text-slate-800">Major events</p><ul className="mt-1 space-y-1">{bubble.timeline.map(event => <li key={`${bubble.id}-${event.year}-${event.title}`}><span className="font-mono text-slate-500">{event.year}</span> · <span className="font-medium text-slate-700">{event.title}:</span> {event.detail}</li>)}</ul><p className="mt-2 font-semibold text-slate-800">Key lessons</p><ul className="mt-1 space-y-1">{bubble.keyLessons.map(lesson => <li key={lesson}>• {lesson}</li>)}</ul></div>
            <div className="md:col-span-2"><p className="font-semibold text-slate-800">Sources</p><ul className="mt-1 space-y-1">{bubble.sources.map(source => <li key={source.url}><a className="underline" href={source.url} target="_blank" rel="noreferrer">{source.name}</a> <span className="text-slate-400">· {source.organization}{source.note ? ` · ${source.note}` : ''}</span></li>)}</ul><p className="mt-2 text-slate-500"><span className="font-semibold text-slate-700">Limitations:</span> {bubble.limitations.join(' ')}</p></div>
          </div>
        </details>)}
      </div>
    </Card>
  </section>;
}
