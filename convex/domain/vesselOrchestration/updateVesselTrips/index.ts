/**
 * Orchestrator concern **updateVesselTrips**: passenger-terminal gates,
 * **`tripLifecycle/`**, tick plan (`processTick/` / `computeVesselTripTickWritePlan`), continuity, read helpers,
 * and re-exports for orchestrator concerns. See `README.md` and
 * `../architecture.md` §10.
 *
 * **updateVesselPredictions** is `applyVesselPredictions` inside `buildTrip`.
 * **updateTimeline** is `buildTimelineTickProjectionInput` under
 * `domain/vesselOrchestration/updateTimeline/`.
 *
 * Production callers use `runProcessVesselTripsTick` (`functions/vesselOrchestrator/runProcessVesselTripsTick.ts`)
 * with `computeVesselTripTickWritePlan`, `createDefaultProcessVesselTripsDeps` (domain),
 * and schedule lookup from `createScheduledSegmentLookup` as wired by
 * `executeVesselOrchestratorTick`.
 * **updateTimeline** and **updateVesselPredictions** symbols are exported here
 * for **orchestrator/tick-pipeline discoverability** (one place to see symbols the
 * trip branch composes with); canonical imports for those peers remain their own
 * `index.ts` files—this is not a barrel to re-export “everything.”
 * Tests can inject their own dependencies directly.
 *
 * **Imports:** Callers should take **only the symbols they need** from this entry;
 * do not treat it as “import the whole module” if a narrower peer import suffices.
 *
 * **Peer façade for `functions/vesselOrchestrator`:** `createDefaultProcessVesselTripsDeps`,
 * `ScheduledSegmentLookup`, `TripEvents` (types), and tick symbols below—import this
 * `index`, not deep leaf paths. Some symbols are also re-exported for
 * `functions/vesselTrips` tests so they share the same peer contract as production
 * callers; if this surface grows unwieldy, revisit Step H (engineering memo) with a
 * submodule façade rather than deep imports.
 */

export {
  type BuildTimelineTickProjectionInputArgs,
  buildTimelineTickProjectionInput,
  type TickEventWrites,
  type TimelineTickProjectionInput,
} from "domain/vesselOrchestration/updateTimeline";
export {
  applyVesselPredictions,
  stripTripPredictionsForStorage,
  type VesselPredictionGates,
  type VesselTripCoreProposal,
} from "domain/vesselOrchestration/updateVesselPredictions";
export type { ScheduledSegmentLookup } from "./continuity/resolveDockedScheduledSegment";
export {
  getPassengerTerminalAbbrevs,
  isPassengerTerminalAbbrev,
  isTripEligibleLocation,
} from "./passengerTerminalEligibility";
export { createDefaultProcessVesselTripsDeps } from "./processTick/defaultProcessVesselTripsDeps";
export {
  computeVesselTripTickWritePlan,
  type ProcessVesselTripsDeps,
  type ProcessVesselTripsOptions,
} from "./processTick/processVesselTrips";
export type { VesselTripsTickResult } from "./processTick/tickEnvelope";
export { computeShouldRunPredictionFallback } from "./processTick/tickPredictionPolicy";
export {
  type ProcessCompletedTripsDeps,
  processCompletedTrips,
} from "./tripLifecycle/processCompletedTrips";
export type { TripEvents } from "./tripLifecycle/tripEventTypes";
export type { CurrentTripTickWriteFragment } from "./tripLifecycle/vesselTripTickWritePlan";
export type { VesselTripsBuildTripAdapters } from "./vesselTripsBuildTripAdapters";
