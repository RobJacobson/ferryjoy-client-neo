/**
 * Vessel orchestration domain: top-level package surface for trip-tick entry
 * points plus peer concern namespaces.
 *
 * Post-fetch DB writes for one pass are sequenced in Convex
 * `functions/vesselOrchestrator/actions.ts` (`updateVesselOrchestrator`), using
 * `computeVesselTripsWithClock` for the trip branch and peer concern barrels for
 * shared / predictions / timeline helpers. The orchestrator creates
 * `tickStartedAt` once per run; {@link computeVesselTripsWithClock} requires it.
 */

export * as shared from "./shared";
export * as updateTimeline from "./updateTimeline";
export * as updateVesselLocations from "./updateVesselLocations";
export * as updateVesselPredictions from "./updateVesselPredictions";
export {
  type ActiveTripsBranch,
  type BuildTripCoreResult,
  computeShouldRunPredictionFallback,
  computeVesselTripsBundle,
  computeVesselTripsWithClock,
  createDefaultProcessVesselTripsDeps,
  type PendingLeaveDockEffect,
  type ProcessVesselTripsDeps,
  type TripEvents,
  type VesselTripsComputeBundle,
  type VesselTripsWithClock,
  type VesselTripsWithClockOptions,
} from "./updateVesselTrips";

/**
 * Top-level export style:
 * - import trip-tick entry points as named exports from `domain/vesselOrchestration`
 * - import cross-pipeline helpers via the `shared`, `updateVesselPredictions`,
 *   and `updateTimeline` namespaces exposed here
 * - when working entirely inside one concern, prefer that concern's local barrel
 *
 * Transitional note:
 * - the named exports above still include legacy trip compute surfaces so the
 *   repo stays coherent during Stage A
 * - the canonical public contract story now lives in the concern barrels,
 *   especially `updateVesselLocations`, `updateVesselTrips`,
 *   `updateVesselPredictions`, and `updateTimeline`
 */
