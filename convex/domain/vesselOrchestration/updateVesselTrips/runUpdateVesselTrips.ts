/**
 * Pure trip-update pipeline: prepare → complete → active → merge with carry-forward.
 */

import { finalizeCompletedTrips } from "./finalizeCompletedTrips";
import { prepareTripUpdates } from "./prepareTripUpdates";
import { createScheduleTripAdaptersFromSnapshot } from "./scheduleTripAdapters";
import { buildCompletedTrip } from "./tripLifecycle/buildCompletedTrip";
import { buildTripCore } from "./tripLifecycle/buildTrip";
import { detectTripEvents } from "./tripLifecycle/detectTripEvents";
import type {
  RunUpdateVesselTripsInput,
  RunUpdateVesselTripsOutput,
} from "./types";
import { updateActiveTrips } from "./updateActiveTrips";

/**
 * Runs one orchestrator tick: derives completed rows and merged active trips.
 */
export const runUpdateVesselTrips = (
  input: RunUpdateVesselTripsInput
): RunUpdateVesselTripsOutput => {
  const buildTripAdapters = createScheduleTripAdaptersFromSnapshot(
    input.scheduleContext
  );
  const prepared = prepareTripUpdates(input, detectTripEvents);

  const completionResolutions = finalizeCompletedTrips(
    prepared.completedTripUpdates,
    buildCompletedTrip,
    buildTripCore,
    buildTripAdapters
  );
  const continuingActives = updateActiveTrips(
    prepared.activeTripUpdates,
    buildTripCore,
    buildTripAdapters
  );

  const processedActiveTrips = [
    ...completionResolutions.flatMap((resolution) =>
      resolution.replacementActiveTrip !== undefined
        ? [resolution.replacementActiveTrip]
        : []
    ),
    ...continuingActives,
  ];

  return {
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
};

/**
 * Builds a full active set: processed rows override existing rows by vessel.
 *
 * Existing rows are always carried unless replaced by a processed row, so the
 * output remains one row per vessel and downstream upsert dedupe can decide
 * whether a row materially changed (for example by `TimeStamp`).
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
