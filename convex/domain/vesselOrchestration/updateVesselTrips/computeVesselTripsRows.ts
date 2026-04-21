/**
 * Pure trip-update pipeline for one orchestrator ping.
 *
 * Flow: build schedule lookup → prepare per-vessel updates → finalize completions
 * → project actives → merge with carry-forward so untouched vessels keep rows.
 */

import { createScheduledSegmentLookupFromSnapshot } from "domain/vesselOrchestration/shared";
import { finalizeCompletedTrips } from "./finalizeCompletedTrips";
import { prepareTripUpdates } from "./prepareTripUpdates";
import { detectTripEvents } from "./tripLifecycle/detectTripEvents";
import type {
  RunUpdateVesselTripsInput,
  RunUpdateVesselTripsOutput,
} from "./types";
import { updateActiveTrips } from "./updateActiveTrips";

/**
 * Derives completed trip rows and the full active set for one feed batch.
 *
 * @param input - Live locations, prior actives, and today’s schedule snapshot
 * @returns Completed rows plus merged active rows (one per vessel after merge)
 */
export const computeVesselTripsRows = (
  input: RunUpdateVesselTripsInput
): RunUpdateVesselTripsOutput => {
  // Segment-key and same-day schedule queries for this ping.
  const scheduleLookup = createScheduledSegmentLookupFromSnapshot(
    input.scheduleContext
  );

  // One prepared row per feed vessel: events + optional prior active trip.
  const prepared = prepareTripUpdates(input, detectTripEvents);

  // Completing vessels: closed row + optional replacement active from same ping.
  const completionResolutions = finalizeCompletedTrips(
    prepared.completedTripUpdates,
    scheduleLookup
  );

  // Non-completing vessels: next active projection for this ping only.
  const continuingActives = updateActiveTrips(
    prepared.activeTripUpdates,
    scheduleLookup
  );

  // All active rows produced this ping (completions then continuing).
  const processedActiveTrips = [
    ...completionResolutions.flatMap((resolution) =>
      resolution.replacementActiveTrip !== undefined
        ? [resolution.replacementActiveTrip]
        : []
    ),
    ...continuingActives,
  ];

  // Public contract: completed closes plus full active set (merge carry-forward).
  const outputTrips: RunUpdateVesselTripsOutput = {
    completedTrips: completionResolutions.flatMap((resolution) =>
      resolution.completedVesselTrip !== undefined
        ? [resolution.completedVesselTrip]
        : []
    ),
    activeTrips: mergeActiveTripRows(
      input.existingActiveTrips,
      processedActiveTrips
    ),
  };

  return outputTrips;
};

/**
 * Merges prior actives with rows produced this ping; later entries win by
 * vessel key.
 *
 * @param existingActiveTrips - Actives before this ping (including vessels not
 *   in the feed batch)
 * @param processedActiveTrips - Replacement actives from completion and active
 *   paths
 * @returns One row per vessel so downstream upserts can compare `TimeStamp`
 *   (and similar) for material changes
 */
const mergeActiveTripRows = (
  existingActiveTrips: ReadonlyArray<
    RunUpdateVesselTripsInput["existingActiveTrips"][number]
  >,
  processedActiveTrips: ReadonlyArray<
    RunUpdateVesselTripsOutput["activeTrips"][number]
  >
): ReadonlyArray<RunUpdateVesselTripsOutput["activeTrips"][number]> => {
  // Map last-write-wins: processed rows override stale actives for same vessel.
  const mergedByVessel = new Map<
    string,
    RunUpdateVesselTripsOutput["activeTrips"][number]
  >([
    ...existingActiveTrips.map((trip) => [trip.VesselAbbrev, trip] as const),
    ...processedActiveTrips.map((trip) => [trip.VesselAbbrev, trip] as const),
  ]);
  return [...mergedByVessel.values()];
};
