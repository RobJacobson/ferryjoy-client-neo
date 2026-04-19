/**
 * Orchestrator concern **updateTimeline**: sparse `eventsActual` /
 * `eventsPredicted` writes for one tick. Canonical implementation lives in this
 * folder (`tickEventWrites`, assembler, `buildTimelineTickProjectionInput`).
 */

export {
  type BuildTimelineTickProjectionInputArgs,
  buildTimelineTickProjectionInput,
} from "./buildTimelineTickProjectionInput";
export {
  mergeTickEventWrites,
  type TickEventWrites,
  type TimelineTickProjectionInput,
} from "./tickEventWrites";
export { buildTickEventWritesFromCompletedFacts } from "./timelineEventAssembler";
export type {
  CompletedTripBoundaryFact,
  CurrentTripActualEventMessage,
  CurrentTripLifecycleBranchResult,
  CurrentTripPredictedEventMessage,
  TripLifecycleApplyOutcome,
  TripTickLifecycleOutcome,
  VesselTripPersistResult,
} from "./types";
