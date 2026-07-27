import type { TimelineHoverInfo } from './TimelineEntity';
import type { HistoricalEvent } from './HistoricalEvent';

export interface HistoricalInteractionState {
  hoveredEntity: TimelineHoverInfo | null;
  selectedEntityId: string | null;
  focusedEntityId: string | null;
}

export type InteractionListener = (state: HistoricalInteractionState) => void;

export interface IHistoricalInteractionController {
  selectEntity(id: string | null): void;
  hoverEntity(hoverInfo: TimelineHoverInfo | null): void;
  clearHover(): void;
  focusEntity(id: string | null): void;
  clearFocus(): void;
  clearSelection(): void;
  getState(): HistoricalInteractionState;
  getFocusedEntity(): HistoricalEvent | null;
  subscribe(listener: InteractionListener): () => void;
}
