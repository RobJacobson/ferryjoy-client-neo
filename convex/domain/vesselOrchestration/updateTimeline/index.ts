/**
 * Orchestrator concern **updateTimeline**: sparse `eventsActual` /
 * `eventsPredicted` writes for one tick. Canonical implementation lives in this
 * folder (`tickEventWrites`, assembler, `buildTimelineTickProjectionInput`).
 *
 * Stage A contracts: `contracts.ts`. Canonical domain entry is
 * {@link runUpdateVesselTimeline} (`RunUpdateVesselTimelineInput` → output).
 * For `mergeTickEventWrites` / tick assemblers, use `domain/vesselOrchestration/shared`
 * or import from `timelineEventAssembler` / `tickEventWrites` within this folder.
 * Tests may import `orchestratorTimelineProjection` internals directly.
 */

export {
  type BuildTimelineTickProjectionInputArgs,
  buildTimelineTickProjectionInput,
  type TimelineProjectionAssembly,
} from "./buildTimelineTickProjectionInput";
export type {
  ActualDockEventRow,
  PredictedDockEventRow,
  RunUpdateVesselTimelineInput,
  RunUpdateVesselTimelineOutput,
  TimelineTripComputation,
  TimelineTripComputationPersist,
} from "./contracts";
export { runUpdateVesselTimeline } from "./orchestratorTimelineProjection";
export type {
  TickEventWrites,
  TimelineTickProjectionInput,
} from "./tickEventWrites";
export type {
  CompletedTripBoundaryFact,
  CurrentTripActualEventMessage,
  CurrentTripLifecycleBranchResult,
  CurrentTripPredictedEventMessage,
  TripTickLifecycleOutcome,
  VesselTripPersistResult,
} from "./types";
