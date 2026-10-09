import type { TimelineEntity, TimelineRenderContext, TimelineHoverInfo, TimelineBoundingBox } from '../types/TimelineEntity';

export class TimelineRenderer {
  private static boundingBoxes = new Map<string, TimelineBoundingBox>();
  private static textCache = new Map<string, number>();

  /**
   * Main rendering method executing the 4 deterministic layers.
   */
  public static render(context: TimelineRenderContext, entities: TimelineEntity[]): void {
    const { ctx, width, height, padding, yearToX } = this.setupContext(context);
    this.boundingBoxes.clear();

    if (!entities.length) return;

    // Filter and sort entities by layer
    const rangeEntities = entities.filter(e => e.type === 'range');
    const pointEntities = entities.filter(e => e.type === 'point');

    // Layer 1: Range Entities (regimes, bubbles, recessions)
    this.renderRangeLayer(ctx, rangeEntities, yearToX, width, height, padding, context);

    // Layer 2: Point Entities (events, releases, announcements)
    this.renderPointLayer(ctx, pointEntities, yearToX, width, height, padding, context);

    // Layer 3: Selection Layer
    if (context.selectedEntityId) {
      this.renderSelectionLayer(ctx, entities, context.selectedEntityId, yearToX, height, padding);
    }

    // Layer 4: Hover Layer (screen coordinates & bounding box tracking)
    if (context.hoveredEntityId) {
      this.renderHoverLayer(ctx, entities, context.hoveredEntityId, yearToX, height, padding);
    }
  }

  /**
   * Hit test method returning hover info for mouse/pointer coordinates.
   */
  public static hitTest(
    mouseX: number,
    mouseY: number,
    entities: TimelineEntity[],
    canvasRect: { left: number; top: number }
  ): TimelineHoverInfo | null {
    for (const entity of entities) {
      const box = this.boundingBoxes.get(entity.id);
      if (box) {
        if (
          mouseX >= box.x &&
          mouseX <= box.x + box.width &&
          mouseY >= box.y &&
          mouseY <= box.y + box.height
        ) {
          return {
            entity,
            boundingRect: box,
            screenCoords: {
              x: canvasRect.left + box.x + box.width / 2,
              y: canvasRect.top + box.y,
            },
          };
        }
      }
    }
    return null;
  }

  // --- Layer 1: Range Entities ---
  private static renderRangeLayer(
    ctx: CanvasRenderingContext2D,
    ranges: TimelineEntity[],
    yearToX: (year: number) => number,
    width: number,
    height: number,
    padding: { left: number; top: number; right: number; bottom: number },
    context: TimelineRenderContext
  ): void {
    const plotTop = padding.top;
    const plotBottom = height - padding.bottom;
    const plotHeight = plotBottom - plotTop;

    ranges.forEach(range => {
      const x1 = Math.max(padding.left, yearToX(range.start));
      const x2 = Math.min(width - padding.right, yearToX(range.end ?? range.start));
      const bandWidth = Math.max(2, x2 - x1);

      const color = range.color ?? '#3b82f6';
      const opacity = range.opacity ?? 0.12;

      // 1A: Shaded background polygon
      ctx.fillStyle = this.withOpacity(color, opacity);
      ctx.fillRect(x1, plotTop, bandWidth, plotHeight);

      // 1B: Dashed boundary lines
      ctx.save();
      ctx.strokeStyle = this.withOpacity(color, 0.4);
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);

      ctx.beginPath();
      ctx.moveTo(x1, plotTop);
      ctx.lineTo(x1, plotBottom);
      ctx.moveTo(x2, plotTop);
      ctx.lineTo(x2, plotBottom);
      ctx.stroke();
      ctx.restore();

      // 1C: Range label at top of band
      ctx.font = '500 10px "IBM Plex Sans Variable", "IBM Plex Sans", sans-serif';
      const textMetrics = ctx.measureText(range.label);
      const textWidth = textMetrics.width;
      const labelX = Math.max(x1 + 4, Math.min(x2 - textWidth - 4, x1 + (bandWidth - textWidth) / 2));
      const labelY = plotTop + 14;

      ctx.fillStyle = this.withOpacity(color, 0.9);
      ctx.fillText(range.label, labelX, labelY);

      // Store bounding box for hit testing
      this.boundingBoxes.set(range.id, {
        x: x1,
        y: plotTop,
        width: bandWidth,
        height: plotHeight,
      });
    });
  }

  // --- Layer 2: Point Entities & Label Collision Handling ---
  private static renderPointLayer(
    ctx: CanvasRenderingContext2D,
    points: TimelineEntity[],
    yearToX: (year: number) => number,
    width: number,
    height: number,
    padding: { left: number; top: number; right: number; bottom: number },
    context: TimelineRenderContext
  ): void {
    const plotTop = padding.top;
    const plotBottom = height - padding.bottom;

    // Collision detection & tier assignment
    const tiers = this.assignLabelTiers(ctx, points, yearToX);

    points.forEach((point, index) => {
      const x = yearToX(point.start);
      if (x < padding.left || x > width - padding.right) return;

      const color = point.color ?? '#2563eb';
      const tier = tiers[index] ?? 0;
      const labelY = plotTop + 24 + tier * 18;

      // 2A: Vertical dashed indicator line
      ctx.save();
      ctx.strokeStyle = this.withOpacity(color, 0.5);
      ctx.lineWidth = 1.25;
      ctx.setLineDash([3, 3]);

      ctx.beginPath();
      ctx.moveTo(x, plotTop);
      ctx.lineTo(x, plotBottom);
      ctx.stroke();
      ctx.restore();

      // 2B: Pin node circle
      const radius = point.importance >= 4 ? 4.5 : 3.5;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, labelY, radius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 2C: Label badge
      ctx.font = '500 9px "IBM Plex Sans Variable", "IBM Plex Sans", sans-serif';
      const textMetrics = ctx.measureText(point.label);
      const textWidth = textMetrics.width;
      const badgePadding = 4;
      const badgeWidth = textWidth + badgePadding * 2;
      const badgeHeight = 14;
      const badgeX = Math.max(padding.left, Math.min(width - padding.right - badgeWidth, x + 6));
      const badgeY = labelY - badgeHeight / 2;

      // Background badge pill
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.08)';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.roundRect(badgeX, badgeY, badgeWidth, badgeHeight, 3);
      ctx.fill();
      ctx.shadowColor = 'transparent';

      ctx.strokeStyle = this.withOpacity(color, 0.4);
      ctx.lineWidth = 1;
      ctx.stroke();

      // Text
      ctx.fillStyle = '#161a16';
      ctx.fillText(point.label, badgeX + badgePadding, badgeY + 10);

      // Store bounding box for hit testing
      this.boundingBoxes.set(point.id, {
        x: badgeX,
        y: badgeY,
        width: badgeWidth,
        height: badgeHeight,
      });
    });
  }

  // --- Layer 3: Selection Layer ---
  private static renderSelectionLayer(
    ctx: CanvasRenderingContext2D,
    entities: TimelineEntity[],
    selectedId: string,
    yearToX: (year: number) => number,
    height: number,
    padding: { left: number; top: number; right: number; bottom: number }
  ): void {
    const box = this.boundingBoxes.get(selectedId);
    if (!box) return;

    ctx.save();
    ctx.strokeStyle = '#2a78d6';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(42, 120, 214, 0.35)';
    ctx.shadowBlur = 6;
    ctx.strokeRect(box.x - 2, box.y - 2, box.width + 4, box.height + 4);
    ctx.restore();
  }

  // --- Layer 4: Hover Layer ---
  private static renderHoverLayer(
    ctx: CanvasRenderingContext2D,
    entities: TimelineEntity[],
    hoveredId: string,
    yearToX: (year: number) => number,
    height: number,
    padding: { left: number; top: number; right: number; bottom: number }
  ): void {
    const box = this.boundingBoxes.get(hoveredId);
    if (!box) return;

    ctx.save();
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(box.x - 1, box.y - 1, box.width + 2, box.height + 2);
    ctx.restore();
  }

  private static measureTextCached(ctx: CanvasRenderingContext2D, text: string): number {
    if (this.textCache.has(text)) {
      return this.textCache.get(text)!;
    }
    const width = ctx.measureText(text).width;
    this.textCache.set(text, width);
    return width;
  }

  // --- Label Collision Detection Algorithm ---
  private static assignLabelTiers(
    ctx: CanvasRenderingContext2D,
    points: TimelineEntity[],
    yearToX: (year: number) => number
  ): number[] {
    ctx.font = '500 9px "IBM Plex Sans Variable", "IBM Plex Sans", sans-serif';
    const placedTiers: Array<Array<{ left: number; right: number }>> = [];
    const resultTiers: number[] = new Array(points.length).fill(0);

    points.forEach((point, index) => {
      const x = yearToX(point.start);
      const textWidth = this.measureTextCached(ctx, point.label);
      const left = x;
      const right = x + textWidth + 12;

      let tier = 0;
      while (true) {
        if (!placedTiers[tier]) {
          placedTiers[tier] = [];
        }

        const overlaps = placedTiers[tier].some(
          b => Math.max(left, b.left) < Math.min(right, b.right)
        );

        if (!overlaps || tier >= 5) {
          placedTiers[tier].push({ left, right });
          resultTiers[index] = tier;
          break;
        }

        tier++;
      }
    });

    return resultTiers;
  }

  // --- Context Setup Helper ---
  private static setupContext(context: TimelineRenderContext) {
    const { canvas, context: ctx, dimensions, visibleRange } = context;
    const { width, height, padding } = dimensions;

    const span = Math.max(1, visibleRange.endYear - visibleRange.startYear);
    const plotWidth = width - padding.left - padding.right;

    const yearToX = (year: number) => {
      const pct = (year - visibleRange.startYear) / span;
      return padding.left + pct * plotWidth;
    };

    return { ctx, width, height, padding, yearToX };
  }

  private static withOpacity(color: string, opacity: number): string {
    if (/^#[0-9a-f]{6}$/i.test(color)) {
      const val = parseInt(color.slice(1), 16);
      return `rgba(${(val >> 16) & 255}, ${(val >> 8) & 255}, ${val & 255}, ${opacity})`;
    }
    return color;
  }
}
