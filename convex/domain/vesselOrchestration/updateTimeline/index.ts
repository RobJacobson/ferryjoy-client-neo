/**
 * Orchestrator concern **updateTimeline**: sparse `eventsActual` /
 * `eventsPredicted` writes for one tick. Canonical implementation lives in this
 * folder (`tickEventWrites`, assembler, `buildTimelineTickProjectionInput`).
 *
 * Stage A canonical contracts live in `contracts.ts`. The current
 * `runUpdateVesselTimeline` runner remains transitional because the functions
 * layer still hands it lifecycle outcomes rather than the final PRD handoff.
 */

export {
  type BuildTimelineTickProjectionInputArgs,
  buildTimelineTickProjectionInput,
} from "./buildTimelineTickProjectionInput";
export type {
  ActualDockEventRow,
  PredictedDockEventRow,
  RunUpdateVesselTimelineInput,
  RunUpdateVesselTimelineOutput,
} from "./contracts";
export {
  buildOrchestratorTimelineProjectionInput,
  mergeTripApplyWithMlForTimeline,
  runUpdateVesselTimeline,
} from "./orchestratorTimelineProjection";
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
