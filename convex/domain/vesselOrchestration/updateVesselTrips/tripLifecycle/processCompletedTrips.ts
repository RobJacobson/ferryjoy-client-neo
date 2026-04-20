/**
 * Completed-trip processing for vessel trip updates.
 *
 * Produces **plan rows** for trip-boundary handoffs (successful builds only).
 * Convex mutations run in the functions-layer applier; timeline writes are
 * assembled after apply from persisted outcomes.
 */

import type { CompletedTripBoundaryFact } from "domain/vesselOrchestration/shared";
import type { VesselTripsBuildTripAdapters } from "domain/vesselOrchestration/updateVesselTrips/vesselTripsBuildTripAdapters";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import type { buildCompletedTrip } from "./buildCompletedTrip";
import type { buildTripCore } from "./buildTrip";
import type { TripEvents } from "./tripEventTypes";

type CompletedTripTransition = {
  currLocation: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip;
  events: TripEvents;
};

export type ProcessCompletedTripsDeps = {
  buildCompletedTrip: typeof buildCompletedTrip;
  buildTripCore: typeof buildTripCore;
  buildTripAdapters: VesselTripsBuildTripAdapters;
};

/**
 * Builds trip-boundary handoff plan rows (successful builds only). Mutations
 * are applied later by the functions-layer trip tick write applier.
 *
 * @param completedTrips - Trip-boundary transitions for this tick
 * @param logVesselProcessingError - Error logger owned by the top-level updater
 * @param deps - Injectable helpers for completed-trip processing
 * @returns Plan rows in input order for vessels whose build succeeded
 */
export const processCompletedTrips = async (
  completedTrips: CompletedTripTransition[],
  logVesselProcessingError: (
    vesselAbbrev: string,
    phase: string,
    error: unknown
  ) => void,
  deps: ProcessCompletedTripsDeps
): Promise<ReadonlyArray<CompletedTripBoundaryFact>> => {
  const settledResults = await Promise.allSettled(
    completedTrips.map((transition) =>
      processCompletedTripTransition(transition, deps)
    )
  );

  return normalizeCompletedTripBuildResults(
    completedTrips,
    settledResults,
    logVesselProcessingError
  );
};

/**
 * Builds one completed-trip handoff row (no persistence).
 *
 * @param transition - Trip-boundary transition for one vessel
 * @param deps - Injectable helpers for completed-trip processing
 * @returns Boundary fact payload for the applier and timeline (after mutation success)
 */
const processCompletedTripTransition = async (
  transition: CompletedTripTransition,
  deps: ProcessCompletedTripsDeps
): Promise<CompletedTripBoundaryFact> => {
  const { existingTrip, currLocation, events } = transition;
  const tripToComplete = deps.buildCompletedTrip(
    existingTrip,
    currLocation,
    events.didJustArriveAtDock
  );
  const newTripCore = await deps.buildTripCore(
    currLocation,
    tripToComplete,
    true,
    events,
    deps.buildTripAdapters
  );

  return {
    existingTrip,
    tripToComplete,
    events,
    newTripCore,
  };
};

/**
 * Keeps fulfilled build rows in input order; logs rejected builds.
 *
 * @param completedTrips - Original transition list
 * @param settledResults - Settled results in input order
 * @param logVesselProcessingError - Error logger owned by the top-level updater
 * @returns Plan rows for successful builds only
 */
const normalizeCompletedTripBuildResults = (
  completedTrips: CompletedTripTransition[],
  settledResults: PromiseSettledResult<CompletedTripBoundaryFact>[],
  logVesselProcessingError: (
    vesselAbbrev: string,
    phase: string,
    error: unknown
  ) => void
): CompletedTripBoundaryFact[] =>
  settledResults.flatMap((result, index) => {
    if (result.status === "fulfilled") {
      return [result.value];
    }

    const transition = completedTrips[index];
    logVesselProcessingError(
      transition?.currLocation.VesselAbbrev ?? "unknown",
      "completed-trip processing",
      result.reason
    );
    return [];
  });
