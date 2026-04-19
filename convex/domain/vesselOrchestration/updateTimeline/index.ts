/**
 * Orchestrator concern **updateTimeline**: sparse `eventsActual` /
 * `eventsPredicted` writes for one tick. Canonical implementation lives in this
 * folder (`tickEventWrites`, assembler, `buildTimelineTickProjectionInput`).
 *
 * Stage A contracts: `contracts.ts`. Canonical domain entry is
 * {@link runUpdateVesselTimeline} (`RunUpdateVesselTimelineInput` → output).
 * {@link buildOrchestratorTimelineProjectionInput} remains for legacy call sites;
 * prefer handoff-driven `runUpdateVesselTimeline`.
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
  TimelineTripComputation,
  TimelineTripComputationPersist,
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
