import type { HistoricalEvent } from '../types/HistoricalEvent';
import type { TimelineHoverInfo } from '../types/TimelineEntity';
import type { HistoricalInteractionState, InteractionListener } from '../types/HistoricalInteraction';
import { HistoricalContextEngine } from '../engine/HistoricalContextEngine';

export class HistoricalInteractionController {
  private state: HistoricalInteractionState = {
    hoveredEntity: null,
    selectedEntityId: null,
    focusedEntityId: null,
  };

  private listeners = new Set<InteractionListener>();

  public getState(): HistoricalInteractionState {
    return { ...this.state };
  }

  public selectEntity(id: string | null): void {
    if (this.state.selectedEntityId === id) return;
    this.state = { ...this.state, selectedEntityId: id };
    this.notify();
  }

  public toggleSelectEntity(id: string | null): void {
    const nextId = this.state.selectedEntityId === id ? null : id;
    this.selectEntity(nextId);
  }

  public hoverEntity(hoverInfo: TimelineHoverInfo | null): void {
    if (this.state.hoveredEntity?.entity.id === hoverInfo?.entity.id) return;
    this.state = { ...this.state, hoveredEntity: hoverInfo };
    this.notify();
  }

  public clearHover(): void {
    if (this.state.hoveredEntity === null) return;
    this.state = { ...this.state, hoveredEntity: null };
    this.notify();
  }

  public focusEntity(id: string | null): void {
    if (this.state.focusedEntityId === id) return;
    this.state = { ...this.state, focusedEntityId: id };
    this.notify();
  }

  public clearFocus(): void {
    if (this.state.focusedEntityId === null) return;
    this.state = { ...this.state, focusedEntityId: null };
    this.notify();
  }

  public clearSelection(): void {
    if (this.state.selectedEntityId === null) return;
    this.state = { ...this.state, selectedEntityId: null };
    this.notify();
  }

  public getFocusedEntity(): HistoricalEvent | null {
    const targetId = this.state.focusedEntityId ?? this.state.selectedEntityId ?? this.state.hoveredEntity?.entity.id;
    if (!targetId) return null;

    const events = HistoricalContextEngine.getAllEvents();
    return events.find(e => e.id === targetId) ?? null;
  }

  public subscribe(listener: InteractionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const currentState = this.getState();
    this.listeners.forEach(listener => listener(currentState));
  }
}

// Global controller instance
export const interactionController = new HistoricalInteractionController();
