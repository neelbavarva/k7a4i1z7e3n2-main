import type { TimelineEntity } from '../types/TimelineEntity';
import type { HistoricalInteractionController } from './HistoricalInteractionController';

export class HistoricalKeyboardAdapter {
  static handleKeyDown(
    event: KeyboardEvent,
    entities: TimelineEntity[],
    controller: HistoricalInteractionController
  ): void {
    if (!entities.length) return;

    const currentState = controller.getState();
    const activeId = currentState.focusedEntityId ?? currentState.selectedEntityId ?? currentState.hoveredEntity?.entity.id;
    const currentIndex = entities.findIndex(e => e.id === activeId);

    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowDown': {
        event.preventDefault();
        const nextIndex = currentIndex < 0 ? 0 : Math.min(entities.length - 1, currentIndex + 1);
        controller.focusEntity(entities[nextIndex].id);
        break;
      }
      case 'ArrowLeft':
      case 'ArrowUp': {
        event.preventDefault();
        const prevIndex = currentIndex < 0 ? entities.length - 1 : Math.max(0, currentIndex - 1);
        controller.focusEntity(entities[prevIndex].id);
        break;
      }
      case 'Enter':
      case ' ': {
        event.preventDefault();
        if (activeId) {
          controller.selectEntity(activeId);
        }
        break;
      }
      case 'Escape': {
        event.preventDefault();
        controller.clearFocus();
        controller.clearSelection();
        controller.clearHover();
        break;
      }
    }
  }
}
