/**
 * Orchestrator concern **updateTimeline**: sparse `eventsActual` /
 * `eventsPredicted` writes for one ping. Canonical implementation lives in this
 * folder (`timelineEventAssembler`, `buildDockWritesFromTripHandoff`).
 *
 * Stage A contracts: `contracts.ts`. Canonical domain entry is
 * {@link updateTimeline} (`RunUpdateVesselTimelineFromAssemblyInput` → output).
 * Ping write types and `mergePingEventWrites` live in
 * `domain/vesselOrchestration/shared/pingHandshake/projectionWire`; handshake DTOs
 * live in `shared/pingHandshake/types`.
 * Tests may import `updateTimeline` internals directly.
 */

export type { PingEventWrites } from "domain/vesselOrchestration/shared/pingHandshake/projectionWire";
export type {
  ActiveTripWriteOutcome,
  ActualDockWriteIntent,
  CompletedArrivalHandoff,
  MlTimelineOverlay,
  PersistedTripTimelineHandoff,
  PredictedDockWriteIntent,
} from "domain/vesselOrchestration/shared/pingHandshake/types";
export {
  type BuildDockWritesFromTripHandoffArgs,
  buildDockWritesFromTripHandoff,
} from "./buildDockWritesFromTripHandoff";
export type {
  RunUpdateVesselTimelineFromAssemblyInput,
  RunUpdateVesselTimelineOutput,
} from "./contracts";
export { timelineHandoffFromTripUpdate } from "./timelineHandoffFromTripUpdate";
export { updateTimeline } from "./updateTimeline";
