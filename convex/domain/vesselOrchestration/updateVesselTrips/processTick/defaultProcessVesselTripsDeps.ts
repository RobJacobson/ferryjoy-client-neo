/**
 * Default production dependency bag for {@link computeVesselTripTickWritePlan}
 * (**updateVesselTrips**). Consumed by `computeVesselOrchestratorTripTickWrites`
 * (`domain/vesselOrchestration`) as wired from `updateVesselOrchestrator`.
 *
 * Composes lifecycle builders and schedule-backed trip adapters from a
 * {@link ScheduledSegmentLookup} supplied by the functions layer (Convex
 * `runQuery` wiring).
 */

import type { VesselTripPredictionModelAccess } from "domain/ml/prediction/vesselTripPredictionModelAccess";
import type { ScheduledSegmentLookup } from "domain/vesselOrchestration/updateVesselTrips/continuity/resolveDockedScheduledSegment";
import { createBuildTripRuntimeAdapters } from "domain/vesselOrchestration/updateVesselTrips/processTick/buildTripRuntimeAdapters";
import type { ProcessVesselTripsDeps } from "domain/vesselOrchestration/updateVesselTrips/processTick/processVesselTrips";
import { buildCompletedTrip } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildCompletedTrip";
import { buildTrip } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildTrip";
import { detectTripEvents } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/detectTripEvents";

/**
 * Builds the production `ProcessVesselTripsDeps` for one tick from schedule lookups.
 *
 * @param lookup - Segment and sailing-day schedule queries (from Convex internal queries)
 * @param predictionModelAccess - Production ML model reads for this action tick
 * @returns Lifecycle dependencies including `buildTripAdapters` for dock continuity
 */
export const createDefaultProcessVesselTripsDeps = (
  lookup: ScheduledSegmentLookup,
  predictionModelAccess: VesselTripPredictionModelAccess
): ProcessVesselTripsDeps => ({
  buildCompletedTrip,
  buildTrip,
  detectTripEvents,
  buildTripAdapters: createBuildTripRuntimeAdapters(lookup),
  predictionModelAccess,
});
