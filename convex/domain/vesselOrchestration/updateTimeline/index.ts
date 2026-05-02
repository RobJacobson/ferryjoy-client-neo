/**
 * Orchestrator concern **updateTimeline**: sparse `eventsActual` /
 * `eventsPredicted` writes for one ping. **`updateTimeline.ts`** is the assembly
 * entry; **`projectTimelineFromHandoff.ts`** projects from a pre-built handoff.
 * Lower layers: **`timelineEventAssembler`**, **`buildDockWritesFromTripHandoff`**.
 *
 * Stage A contracts: `contracts.ts`. Public entry is {@link updateTimeline}
 * (`RunUpdateVesselTimelineFromAssemblyInput` → output). Ping write types and
 * handoff DTOs live in this folder. Tests may import internals directly (e.g.
 * **`projectTimelineFromHandoff`**).
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
  PersistedTripTimelineHandoff,
  PredictedDockWriteIntent,
  PredictedTripTimelineHandoff,
} from "./handoffTypes";
export { timelineHandoffFromTripUpdate } from "./timelineHandoffFromTripUpdate";
export { updateTimeline } from "./updateTimeline";
