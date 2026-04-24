/**
 * Orchestrator concern **updateTimeline**: sparse `eventsActual` /
 * `eventsPredicted` writes for one ping. Canonical implementation lives in this
 * folder (`timelineEventAssembler`, `buildTimelinePingProjectionInput`).
 *
 * Stage A contracts: `contracts.ts`. Canonical domain entry is
 * {@link runUpdateVesselTimelineFromAssembly} (`RunUpdateVesselTimelineFromAssemblyInput` → output).
 * Ping write types and `mergePingEventWrites` live in
 * `domain/vesselOrchestration/shared/pingHandshake/projectionWire`; handshake DTOs
 * live in `shared/pingHandshake/types`.
 * Tests may import `orchestratorTimelineProjection` internals directly.
 */

export type {
  PingEventWrites,
  TimelinePingProjectionInput,
} from "domain/vesselOrchestration/shared/pingHandshake/projectionWire";
export type {
  CompletedTripBoundaryFact,
  CurrentTripActualEventMessage,
  CurrentTripLifecycleBranchResult,
  CurrentTripPredictedEventMessage,
  TripPingLifecycleOutcome,
  VesselTripPersistResult,
} from "domain/vesselOrchestration/shared/pingHandshake/types";
export {
  type BuildTimelinePingProjectionInputArgs,
  buildTimelinePingProjectionInput,
  type TimelineProjectionAssembly,
} from "./buildTimelinePingProjectionInput";
export type {
  ActualDockEventRow,
  PredictedDockEventRow,
  RunUpdateVesselTimelineFromAssemblyInput,
  RunUpdateVesselTimelineOutput,
} from "./contracts";
export { runUpdateVesselTimelineFromAssembly } from "./orchestratorTimelineProjection";
