'use client';

import type { TimelineHoverInfo } from '@/lib/historical';
import { HistoricalContextEngine } from '@/lib/historical';

interface HistoricalHoverCardProps {
  hoverInfo: TimelineHoverInfo;
  containerBounds?: { width: number; height: number };
}

export function HistoricalHoverCard({ hoverInfo, containerBounds }: HistoricalHoverCardProps) {
  const { entity, screenCoords } = hoverInfo;
  const events = HistoricalContextEngine.getAllEvents();
  const fullEvent = events.find(e => e.id === entity.id);

  // Position calculation with boundary protection
  const cardWidth = 280;
  const cardHeight = 220;

  const left = containerBounds
    ? Math.min(Math.max(12, screenCoords.x - cardWidth / 2), containerBounds.width - cardWidth - 12)
    : screenCoords.x + 12;

  const top = containerBounds
    ? Math.min(Math.max(12, screenCoords.y - cardHeight - 16), containerBounds.height - cardHeight - 12)
    : screenCoords.y - 12;

  const importanceStars = '★'.repeat(entity.importance) + '☆'.repeat(5 - entity.importance);
  const color = entity.color ?? '#2563eb';

  return (
    <div
      className="pointer-events-auto absolute z-20 w-[280px] rounded-lg border border-slate-200 bg-white/95 p-3.5 font-mono text-[11px] text-slate-700 shadow-xl backdrop-blur-md transition-all duration-150"
      style={{ left: `${left}px`, top: `${top}px` }}
      role="dialog"
      aria-label={`Historical Context: ${entity.label}`}
    >
      {/* Header Badge & Importance */}
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-wide uppercase"
          style={{ backgroundColor: `${color}15`, color }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
          {entity.categoryKey ?? entity.type}
        </span>
        <span className="text-[10px] text-amber-500 font-semibold" title={`Importance: Level ${entity.importance}/5`}>
          {importanceStars}
        </span>
      </div>

      {/* Title */}
      <h4 className="mb-1 text-[13px] font-semibold leading-tight text-slate-900">
        {entity.label}
      </h4>

      {/* Date Span */}
      <div className="mb-2 flex items-center gap-2 text-[10px] font-medium text-slate-500">
        <span>
          {entity.start}
          {entity.end ? ` – ${entity.end}` : ''}
        </span>
        {fullEvent?.peakDate && (
          <span className="rounded bg-slate-100 px-1 py-0.5 text-[9px] text-slate-600">
            Peak: {fullEvent.peakDate}
          </span>
        )}
      </div>

      {/* Description */}
      <p className="mb-2.5 line-clamp-3 leading-relaxed text-slate-600">
        {fullEvent?.description ?? (entity.metadata?.description as string) ?? 'Historical landmark event.'}
      </p>

      {/* Tags */}
      {fullEvent?.tags && fullEvent.tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {fullEvent.tags.slice(0, 3).map(tag => (
            <span key={tag} className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-600">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* References */}
      {fullEvent?.references && fullEvent.references.length > 0 && (
        <div className="border-t border-slate-100 pt-1.5 text-[9px] text-slate-400">
          <span className="font-semibold text-slate-500">Source: </span>
          {fullEvent.references[0].url ? (
            <a
              href={fullEvent.references[0].url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline hover:text-blue-800"
            >
              {fullEvent.references[0].name}
            </a>
          ) : (
            <span>{fullEvent.references[0].name}</span>
          )}
        </div>
      )}
    </div>
  );
}
