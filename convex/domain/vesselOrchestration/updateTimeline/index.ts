/**
 * Orchestrator concern **updateTimeline**: sparse `eventsActual` /
 * `eventsPredicted` writes for one ping. Canonical implementation lives in this
 * folder (`pingEventWrites`, assembler, `buildTimelinePingProjectionInput`).
 *
 * Stage A contracts: `contracts.ts`. Canonical domain entry is
 * {@link runUpdateVesselTimeline} (`RunUpdateVesselTimelineInput` → output).
 * For `mergePingEventWrites` / ping assemblers, use `domain/vesselOrchestration/shared`
 * or import from `timelineEventAssembler` / `pingEventWrites` within this folder.
 * Tests may import `orchestratorTimelineProjection` internals directly.
 */

export { assembleTripComputationsFromBundle } from "./assembleTripComputationsFromBundle";
export {
  type BuildTimelinePingProjectionInputArgs,
  buildTimelinePingProjectionInput,
  type TimelineProjectionAssembly,
} from "./buildTimelinePingProjectionInput";
export type {
  ActualDockEventRow,
  PredictedDockEventRow,
  RunUpdateVesselTimelineFromAssemblyInput,
  RunUpdateVesselTimelineInput,
  RunUpdateVesselTimelineOutput,
  TimelineTripComputation,
  TimelineTripComputationPersist,
} from "./contracts";
export {
  runUpdateVesselTimeline,
  runUpdateVesselTimelineFromAssembly,
} from "./orchestratorTimelineProjection";
export type {
  PingEventWrites,
  TimelinePingProjectionInput,
} from "./pingEventWrites";
export type {
  CompletedTripBoundaryFact,
  CurrentTripActualEventMessage,
  CurrentTripLifecycleBranchResult,
  CurrentTripPredictedEventMessage,
  TripPingLifecycleOutcome,
  VesselTripPersistResult,
} from "./types";
