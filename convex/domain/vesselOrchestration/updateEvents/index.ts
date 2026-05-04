/**
 * Orchestrator concern **updateEvents**: sparse `eventsActual` /
 * `eventsPredicted` writes for one ping. **`updateEvents.ts`** is the assembly
 * entry; **`projectEventsFromHandoff.ts`** projects from a pre-built handoff.
 * Lower layers: **`eventWriteAssembler`**, **`buildDockWritesFromTripHandoff`**.
 *
 * Stage A contracts: `contracts.ts`. Public entry is {@link updateEvents}
 * (`RunUpdateVesselEventsFromAssemblyInput` → output). Ping write types and
 * handoff DTOs live in this folder. Tests may import internals directly (e.g.
 * **`projectEventsFromHandoff`**).
 */

export {
  type BuildDockWritesFromTripHandoffArgs,
  buildDockWritesFromTripHandoff,
} from "./buildDockWritesFromTripHandoff";
export { buildCompletedHandoffKey } from "./completedHandoffKey";
export type {
  RunUpdateVesselEventsFromAssemblyInput,
  RunUpdateVesselEventsOutput,
} from "./contracts";
export { eventHandoffFromTripUpdate } from "./eventHandoffFromTripUpdate";
export type {
  ActiveTripWriteOutcome,
  ActualDockWriteIntent,
  CompletedArrivalHandoff,
  PersistedTripEventHandoff,
  PredictedDockWriteIntent,
  PredictedTripEventHandoff,
} from "./handoffTypes";
export { updateEvents } from "./updateEvents";
