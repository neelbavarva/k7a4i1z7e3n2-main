// Types
export type { HistoricalEvent, HistoricalFilterOptions, HistoricalEventReference } from './types/HistoricalEvent';
export type { HistoricalEventCategory } from './types/HistoricalEventCategory';
export type {
  TimelineEntity,
  TimelineEntityType,
  TimelineRenderContext,
  TimelineHoverInfo,
  TimelineBoundingBox,
} from './types/TimelineEntity';
export type {
  HistoricalInteractionState,
  InteractionListener,
  IHistoricalInteractionController,
} from './types/HistoricalInteraction';

// Engines & Registry
export { HistoricalEventRegistry } from './registry/registry';
export { EventIndex } from './engine/EventIndex';
export { EventFilter } from './engine/EventFilter';
export { EventDensity } from './engine/EventDensity';
export { HistoricalContextEngine } from './engine/HistoricalContextEngine';

// Adapters & Renderer
export { TimelineEntityAdapter } from './adapter/TimelineEntityAdapter';
export { TimelineRenderer } from './renderer/TimelineRenderer';

// Interaction Controller & Keyboard Adapter
export { HistoricalInteractionController, interactionController } from './interaction/HistoricalInteractionController';
export { HistoricalKeyboardAdapter } from './interaction/HistoricalKeyboardAdapter';
