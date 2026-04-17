/**
 * Orchestrator concern **updateVesselTrips**: passenger-terminal gates,
 * **`tripLifecycle/`**, tick entry (`processTick/`), continuity, read helpers,
 * and re-exports for orchestrator concerns. See `README.md` and
 * `../architecture.md` §10.
 *
 * **updateVesselPredictions** is `applyVesselPredictions` inside `buildTrip`.
 * **updateTimeline** is `buildTimelineTickProjectionInput` under
 * `domain/vesselOrchestration/updateTimeline/`.
 *
 * Production callers pair `processVesselTripsWithDeps` with
 * `createDefaultProcessVesselTripsDeps` (domain) and `createScheduledSegmentLookup`
 * (`createScheduledSegmentLookup` in `functions/vesselOrchestrator/actions.ts`).
 * **updateTimeline** and **updateVesselPredictions** symbols are exported here
 * for discoverability; the same symbols are re-exported from
 * `domain/vesselOrchestration/updateTimeline` and
 * `domain/vesselOrchestration/updateVesselPredictions`.
 * Tests can inject their own dependencies directly.
 */

export {
  type BuildTimelineTickProjectionInputArgs,
  buildTimelineTickProjectionInput,
} from "domain/vesselOrchestration/updateTimeline/buildTimelineTickProjectionInput";
export type {
  TickEventWrites,
  TimelineTickProjectionInput,
} from "domain/vesselOrchestration/updateTimeline/tickEventWrites";
export {
  applyVesselPredictions,
  stripTripPredictionsForStorage,
  type VesselPredictionGates,
  type VesselTripCoreProposal,
} from "domain/vesselOrchestration/updateVesselPredictions";
export {
  getPassengerTerminalAbbrevs,
  isPassengerTerminalAbbrev,
  isTripEligibleLocation,
} from "./passengerTerminalEligibility";
export type { ProcessVesselTripsOptions } from "./processTick/processVesselTrips";
export type { VesselTripsTickResult } from "./processTick/tickEnvelope";
export { computeShouldRunPredictionFallback } from "./processTick/tickPredictionPolicy";
export type { VesselTripsBuildTripAdapters } from "./vesselTripsBuildTripAdapters";
