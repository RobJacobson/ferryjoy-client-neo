/**
 * Default production dependency bag for {@link computeVesselTripsBundle}
 * (**updateVesselTrips**). Consumed by `computeVesselTripsWithClock`
 * (`domain/vesselOrchestration`) as wired from `updateVesselOrchestrator`.
 *
 * Composes lifecycle builders and schedule-backed trip adapters from a
 * {@link ScheduledSegmentLookup} supplied by the functions layer (prefetched
 * schedule snapshot for production). ML reads are **not** included here; the orchestrator passes
 * model access only to **updateVesselPredictions**.
 */

import type { ScheduledSegmentLookup } from "domain/vesselOrchestration/shared";
import { createBuildTripRuntimeAdapters } from "domain/vesselOrchestration/updateVesselTrips/processTick/buildTripRuntimeAdapters";
import type { ProcessVesselTripsDeps } from "domain/vesselOrchestration/updateVesselTrips/processTick/processVesselTrips";
import { buildCompletedTrip } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildCompletedTrip";
import { buildTripCore } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildTrip";
import { detectTripEvents } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/detectTripEvents";

/**
 * Builds the production `ProcessVesselTripsDeps` for one tick from schedule lookups.
 *
 * @param lookup - Segment and sailing-day schedule queries (from Convex internal queries)
 * @returns Lifecycle dependencies including `buildTripCore` and `buildTripAdapters`
 */
export const createDefaultProcessVesselTripsDeps = (
  lookup: ScheduledSegmentLookup
): ProcessVesselTripsDeps => ({
  buildCompletedTrip,
  buildTripCore,
  detectTripEvents,
  buildTripAdapters: createBuildTripRuntimeAdapters(lookup),
});
