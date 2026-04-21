/**
 * Pure trip-update pipeline for one orchestrator ping.
 *
 * Orchestrates schedule tables, per-feed lifecycle events, completion vs active
 * branches, and a last-write-wins merge so vessels absent from the batch keep
 * prior actives.
 *
 * Flow: schedule lookup → {@link calculateTripUpdates} →
 * {@link calculateUpdatedVesselTrips} → finalize completions → project actives →
 * merge carry-forward.
 */

import { createScheduledSegmentTablesFromSnapshot } from "domain/vesselOrchestration/shared";
import { finalizeCompletedTrips } from "./finalizeCompletedTrips";
import {
  calculateTripUpdates,
  calculateUpdatedVesselTrips,
} from "./prepareTripUpdates";
import type {
  RunUpdateVesselTripsInput,
  RunUpdateVesselTripsOutput,
} from "./types";
import { updateActiveTrips } from "./updateActiveTrips";

/**
 * Derives completed trip rows and the full active set for one feed batch.
 *
 * Completion and active projection run on disjoint subsets of the same feed;
 * replacement actives from completions are concatenated with continuing
 * actives before merging into the authoritative active set.
 *
 * @param input - Live locations, prior actives, and today’s schedule snapshot
 * @returns Completed closes plus merged active rows (one per vessel after merge)
 */
export const computeVesselTripsRows = (
  input: RunUpdateVesselTripsInput
): RunUpdateVesselTripsOutput => {
  // Build segment-key index and same-day scheduled rows for enrichment lookups.
  const scheduleTables = createScheduledSegmentTablesFromSnapshot(
    input.scheduleSnapshot,
    input.sailingDay
  );

  // Join each feed row to its prior active and compute lifecycle flags (no trip
  // rows yet).
  const tripUpdates = calculateTripUpdates(
    input.vesselLocations,
    input.existingActiveTrips
  );

  // Split updates into completion handling vs active projection branches.
  const { completedTripUpdates, activeTripUpdates } =
    calculateUpdatedVesselTrips(tripUpdates);

  // Close completing trips and build replacement actives from the same ping.
  const completionResolutions = finalizeCompletedTrips(
    completedTripUpdates,
    scheduleTables
  );

  // Project next active rows for pings that did not complete a trip.
  const continuingActives = updateActiveTrips(
    activeTripUpdates,
    scheduleTables
  );

  // Collect replacement actives from completions, then from continuing projection.
  const processedActiveTrips = [
    ...completionResolutions.flatMap((resolution) =>
      resolution.replacementActiveTrip !== undefined
        ? [resolution.replacementActiveTrip]
        : []
    ),
    ...continuingActives,
  ];

  // Return completed closes plus merged actives (carry-forward for untouched vessels).
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
  // Merge by vessel with last-write-wins (processed overrides prior for same key).
  const mergedByVessel = new Map<
    string,
    RunUpdateVesselTripsOutput["activeTrips"][number]
  >([
    ...existingActiveTrips.map((trip) => [trip.VesselAbbrev, trip] as const),
    ...processedActiveTrips.map((trip) => [trip.VesselAbbrev, trip] as const),
  ]);
  return [...mergedByVessel.values()];
};
