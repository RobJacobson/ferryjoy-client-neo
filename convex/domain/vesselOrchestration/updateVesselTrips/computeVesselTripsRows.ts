/**
 * Pure trip-update pipeline for one orchestrator ping.
 *
 * Orchestrates schedule tables, per-feed lifecycle events, per-vessel trip
 * rows, and a last-write-wins merge so vessels absent from the batch keep
 * prior actives.
 *
 * Flow: schedule lookup → per-feed {@link calculatedTripUpdateForFeedRow} →
 * {@link tripRowsForVesselPing} → merge carry-forward.
 */

import { createScheduledSegmentTablesFromSnapshot } from "domain/vesselOrchestration/shared";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { calculatedTripUpdateForFeedRow } from "./calculatedTripUpdate";
import { tripRowsForVesselPing } from "./tripRowsForVesselPing";
import type {
  RunUpdateVesselTripsInput,
  RunUpdateVesselTripsOutput,
} from "./types";

/**
 * Derives completed trip rows and the full active set for one feed batch.
 *
 * Each feed row is processed independently; replacement actives from completions
 * are concatenated with continuing actives before merging into the authoritative
 * active set.
 *
 * @param input - Live locations, prior actives, and today’s schedule snapshot
 * @returns Completed closes plus merged active rows (one per vessel after merge)
 */
export const computeVesselTripsRows = (
  input: RunUpdateVesselTripsInput
): RunUpdateVesselTripsOutput => {
  const scheduleTables = createScheduledSegmentTablesFromSnapshot(
    input.scheduleSnapshot,
    input.sailingDay
  );

  const activesByVessel = activeTripsByVesselAbbrev(input.existingActiveTrips);

  const pingRows = input.vesselLocations.map((vesselLocation) => {
    const update = calculatedTripUpdateForFeedRow(
      vesselLocation,
      activesByVessel
    );
    return tripRowsForVesselPing(update, scheduleTables);
  });

  const processedActiveTrips = pingRows
    .map((rows) => rows.activeVesselTrip)
    .filter((trip): trip is ConvexVesselTrip => trip !== undefined);

  return {
    completedTrips: pingRows
      .map((rows) => rows.completedVesselTrip)
      .filter((trip): trip is ConvexVesselTrip => trip !== undefined),
    activeTrips: mergeActiveTripRows(
      input.existingActiveTrips,
      processedActiveTrips
    ),
  };
};

/**
 * Prior active trips keyed by vessel abbrev (later duplicates win, matching
 * plain object merge semantics).
 */
const activeTripsByVesselAbbrev = (
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>
): Partial<Record<string, ConvexVesselTrip>> =>
  Object.fromEntries(
    existingActiveTrips.map((trip) => [trip.VesselAbbrev, trip] as const)
  );

/**
 * Merges prior actives with rows produced this ping; later entries win by
 * vessel key.
 *
 * Vessels not present in `processedActiveTrips` keep their prior row unchanged.
 *
 * @param existingActiveTrips - Actives before this ping (including vessels not
 *   in the feed batch)
 * @param processedActiveTrips - Replacement actives from completion and active
 *   paths
 * @returns One row per vessel so downstream upserts can compare `TimeStamp`
 *   and related fields for material changes
 */
const mergeActiveTripRows = (
  existingActiveTrips: ReadonlyArray<
    RunUpdateVesselTripsInput["existingActiveTrips"][number]
  >,
  processedActiveTrips: ReadonlyArray<
    RunUpdateVesselTripsOutput["activeTrips"][number]
  >
): ReadonlyArray<RunUpdateVesselTripsOutput["activeTrips"][number]> => {
  const mergedByVessel = new Map<
    string,
    RunUpdateVesselTripsOutput["activeTrips"][number]
  >([
    ...existingActiveTrips.map((trip) => [trip.VesselAbbrev, trip] as const),
    ...processedActiveTrips.map((trip) => [trip.VesselAbbrev, trip] as const),
  ]);
  return [...mergedByVessel.values()];
};
