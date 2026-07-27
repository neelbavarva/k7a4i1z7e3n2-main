'use client';

import { useEffect, useRef, useState } from 'react';
import {
  HistoricalContextEngine,
  TimelineEntityAdapter,
  TimelineRenderer,
  interactionController,
  HistoricalKeyboardAdapter,
  type TimelineHoverInfo,
} from '@/lib/historical';
import { HistoricalHoverCard } from './historical-hover-card';

interface TimelineOverlayProps {
  visibleRange: { startYear: number; endYear: number };
  activeDatasetIds?: string[];
  selectedEntityId?: string | null;
  onHoverChange?: (hoverInfo: TimelineHoverInfo | null) => void;
  onSelectEntity?: (entityId: string | null) => void;
  className?: string;
}

export function TimelineOverlay({
  visibleRange,
  activeDatasetIds = [],
  selectedEntityId = null,
  onHoverChange,
  onSelectEntity,
  className = '',
}: TimelineOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverInfo, setHoverInfo] = useState<TimelineHoverInfo | null>(null);
  const [containerBounds, setContainerBounds] = useState<{ width: number; height: number }>({ width: 1000, height: 600 });

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    setContainerBounds({ width, height });

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.scale(dpr, dpr);

    const primaryDataset = activeDatasetIds[0];
    const zoomSpan = Math.max(1, visibleRange.endYear - visibleRange.startYear);

    // Query pre-filtered events from engine
    const events = HistoricalContextEngine.getVisibleEvents(
      {
        datasetId: primaryDataset,
        timeRange: { start: visibleRange.startYear, end: visibleRange.endYear },
      },
      zoomSpan,
      8
    );

    // Adapt to generic TimelineEntity model
    const entities = TimelineEntityAdapter.toEntities(events);

    // Delegate rendering to TimelineRenderer
    TimelineRenderer.render(
      {
        canvas,
        context: ctx,
        dimensions: {
          width,
          height,
          padding: { left: 21, top: 14, right: 21, bottom: 21 },
        },
        visibleRange,
        selectedEntityId,
        hoveredEntityId: hoverInfo?.entity.id ?? null,
      },
      entities
    );

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const hit = TimelineRenderer.hitTest(mouseX, mouseY, entities, rect);
      setHoverInfo(hit);
      interactionController.hoverEntity(hit);
      if (onHoverChange) {
        onHoverChange(hit);
      }
    };

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const hit = TimelineRenderer.hitTest(mouseX, mouseY, entities, rect);
      const targetId = hit?.entity.id ?? null;
      interactionController.selectEntity(targetId);
      if (onSelectEntity) {
        onSelectEntity(targetId);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      HistoricalKeyboardAdapter.handleKeyDown(e, entities, interactionController);
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleKeyDown);
      ctx.clearRect(0, 0, width, height);
    };
  }, [visibleRange.startYear, visibleRange.endYear, activeDatasetIds, selectedEntityId, hoverInfo, onHoverChange, onSelectEntity]);

  return (
    <div ref={containerRef} className={`pointer-events-none absolute inset-0 z-[6] h-full w-full ${className}`}>
      <canvas ref={canvasRef} tabIndex={0} aria-label="Interactive timeline overlay" className="pointer-events-auto h-full w-full outline-none" />
      {hoverInfo && (
        <HistoricalHoverCard hoverInfo={hoverInfo} containerBounds={containerBounds} />
      )}
    </div>
  );
}
