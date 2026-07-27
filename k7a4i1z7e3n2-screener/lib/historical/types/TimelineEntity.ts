export type TimelineEntityType = 'point' | 'range';

export interface TimelineEntity {
  id: string;
  type: TimelineEntityType;
  start: number;
  end: number | null;
  importance: 1 | 2 | 3 | 4 | 5;
  label: string;
  categoryKey?: string;
  color?: string;
  opacity?: number;
  metadata?: Record<string, unknown>;
}

export interface TimelineBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TimelineHoverInfo {
  entity: TimelineEntity;
  boundingRect: TimelineBoundingBox;
  screenCoords: { x: number; y: number };
}

export interface TimelineRenderContext {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  dimensions: {
    width: number;
    height: number;
    padding: { left: number; top: number; right: number; bottom: number };
  };
  visibleRange: { startYear: number; endYear: number };
  selectedEntityId?: string | null;
  hoveredEntityId?: string | null;
}
