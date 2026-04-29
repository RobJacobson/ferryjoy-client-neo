/**
 * Orchestrator concern **updateTimeline**: sparse `eventsActual` /
 * `eventsPredicted` writes for one ping. Canonical implementation lives in this
 * folder (`timelineEventAssembler`, `buildDockWritesFromTripHandoff`).
 *
 * Stage A contracts: `contracts.ts`. Canonical domain entry is
 * {@link updateTimeline} (`RunUpdateVesselTimelineFromAssemblyInput` → output).
 * Ping write types and handoff DTOs live in this folder.
 * Tests may import `updateTimeline` internals directly.
 */

export {
  type BuildDockWritesFromTripHandoffArgs,
  buildDockWritesFromTripHandoff,
} from "./buildDockWritesFromTripHandoff";
export { buildCompletedHandoffKey } from "./completedHandoffKey";
export type {
  RunUpdateVesselTimelineFromAssemblyInput,
  RunUpdateVesselTimelineOutput,
} from "./contracts";
export type {
  ActiveTripWriteOutcome,
  ActualDockWriteIntent,
  CompletedArrivalHandoff,
  MlTimelineOverlay,
  PersistedTripTimelineHandoff,
  PredictedDockWriteIntent,
} from "./handoffTypes";
export { timelineHandoffFromTripUpdate } from "./timelineHandoffFromTripUpdate";
export { updateTimeline } from "./updateTimeline";
