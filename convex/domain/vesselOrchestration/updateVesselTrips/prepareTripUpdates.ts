/**
 * Feed batch preparation for the trip-update pipeline.
 *
 * Two steps: (1) {@link calculateTripUpdates} attaches lifecycle events to each
 * feed row; (2) {@link calculateUpdatedVesselTrips} routes rows to the completion
 * branch or the active-projection branch. {@link prepareTripUpdates} composes
 * both for callers that want a single entry point.
 */

import { detectTripEvents } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/detectTripEvents";
import type {
  CalculatedTripUpdate,
  TripUpdatesRouting,
} from "domain/vesselOrchestration/updateVesselTrips/types";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Joins each realtime row with this vessel's prior active trip (if any) and
 * runs {@link detectTripEvents} on the **raw** feed sample.
 *
 * This answers “what changed on this ping?” only. It does not build
 * `ConvexVesselTrip` rows or select completion vs continuing branches; those
 * happen after {@link calculateUpdatedVesselTrips}.
 *
 * @param vesselLocations - Live feed rows for this batch (one entry per vessel)
 * @param existingActiveTrips - Prior active trips for vessels we already track
 * @returns One {@link CalculatedTripUpdate} per feed row, in feed order
 */
export const calculateTripUpdates = (
  vesselLocations: ReadonlyArray<ConvexVesselLocation>,
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>
): CalculatedTripUpdate[] => {
  const activesByVessel = indexActiveTripsByVessel(existingActiveTrips);

  return vesselLocations.map((vesselLocation) => {
    const existingActiveTrip = activesByVessel[vesselLocation.VesselAbbrev];

    return {
      vesselLocation,
      existingActiveTrip,
      events: detectTripEvents(existingActiveTrip, vesselLocation),
    };
  });
};

/**
 * Routes calculated feed rows to the completion branch vs the active-projection
 * branch.
 *
 * Does not materialize stored trip rows; it only partitions
 * {@link CalculatedTripUpdate} lists. Completion requires both
 * `events.isCompletedTrip` and an `existingActiveTrip` to close; rows that
 * signal completion without a tracked active are omitted from the completion
 * list (they cannot be closed).
 *
 * @param tripUpdates - Output of {@link calculateTripUpdates}
 * @returns {@link TripUpdatesRouting} for {@link finalizeCompletedTrips} and
 *   {@link updateActiveTrips}
 */
export const calculateUpdatedVesselTrips = (
  tripUpdates: ReadonlyArray<CalculatedTripUpdate>
): TripUpdatesRouting => {
  // Select closable updates: completion fired and a prior active row exists.
  const completedTripUpdates = tripUpdates.filter(
    (update): update is TripUpdatesRouting["completedTripUpdates"][number] =>
      update.events.isCompletedTrip && update.existingActiveTrip !== undefined
  );

  return {
    completedTripUpdates,
    // Route non-completion pings to active projection (sea legs, in-port, etc.).
    activeTripUpdates: tripUpdates.filter(
      (update) => !update.events.isCompletedTrip
    ),
  };
};

/**
 * Composes {@link calculateTripUpdates} and {@link calculateUpdatedVesselTrips}
 * for one feed batch.
 *
 * Equivalent to
 * `calculateUpdatedVesselTrips(calculateTripUpdates(...))` when you prefer one
 * call from orchestration code.
 *
 * @param vesselLocations - Live feed rows for this batch (one row each)
 * @param existingActiveTrips - Prior active trips for feed vessels
 * @returns {@link TripUpdatesRouting} for downstream pipeline steps
 */
export const prepareTripUpdates = (
  vesselLocations: ReadonlyArray<ConvexVesselLocation>,
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>
): TripUpdatesRouting =>
  calculateUpdatedVesselTrips(
    calculateTripUpdates(vesselLocations, existingActiveTrips)
  );

/**
 * Builds a vessel-abbrev lookup for prior active trips.
 *
 * Used to join each incoming feed row with at most one stored active row for
 * the same vessel.
 *
 * @param existingActiveTrips - Prior active trips for the batch
 * @returns Partial map from vessel abbrev to trip (missing key means no prior
 *   active for that vessel)
 */
const indexActiveTripsByVessel = (
  existingActiveTrips: ReadonlyArray<ConvexVesselTrip>
): Partial<Record<string, ConvexVesselTrip>> =>
  Object.fromEntries(
    existingActiveTrips.map((trip) => [trip.VesselAbbrev, trip] as const)
  );
