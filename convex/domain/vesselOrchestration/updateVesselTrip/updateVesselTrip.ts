/**
 * Per-vessel trip update computation from one location ping.
 *
 * This module is the domain entrypoint for vessel trip lifecycle updates. It
 * composes row construction, schedule enrichment, and storage comparison while
 * keeping Convex reads and writes outside the pure trip-shaping code.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { isSameVesselTripData } from "./comparison/isSameVesselTripData";
import { applyScheduleToActiveTrip } from "./schedule/applyScheduleToActiveTrip";
import { buildActiveTrip } from "./tripRows/buildActiveTrip";
import { buildCompleteTrip } from "./tripRows/buildCompleteTrip";
import type { UpdateVesselTripDbAccess, VesselTripUpdate } from "./types";

/**
 * Computes storage and lifecycle changes for one vessel ping.
 *
 * @param currLocation - Latest location ping for one vessel
 * @param prevTrip - Existing active trip row for that vessel, when present
 * @param dbAccess - Schedule tables used to enrich new-trip rows (see
 *   applyScheduleToActiveTrip); not consulted on every ping.
 * @returns Trip update when substantive changes exist, otherwise null
 */
const updateVesselTrip = async (
  currLocation: ConvexVesselLocation,
  prevTrip: ConvexVesselTrip | undefined,
  dbAccess: UpdateVesselTripDbAccess
): Promise<VesselTripUpdate | null> => {
  try {
    const isNewTrip = startsNewTripLeg(prevTrip, currLocation);
    const completedVesselTrip =
      isNewTrip && prevTrip !== undefined
        ? buildCompleteTrip(prevTrip, currLocation)
        : undefined;

    // Build the active trip row for this ping.
    const activeTrip = buildActiveTrip({
      prev: prevTrip,
      completedVesselTrip,
      curr: currLocation,
      isNewTrip,
    });

    // Schedule reads run only for new in-service rollover; complete WSF fields use sync merge instead.
    const activeVesselTrip = await applyScheduleToActiveTrip({
      activeTrip,
      prevTrip: prevTrip,
      currLocation: currLocation,
      isNewTrip,
      dbAccess,
    });

    const isActiveVesselTripUnchanged = isSameVesselTripData(
      prevTrip,
      activeVesselTrip
    );

    // Suppress no-op active-only updates but always emit completion rollover.
    if (completedVesselTrip === undefined && isActiveVesselTripUnchanged) {
      return null;
    }

    // Return the completed vessel trip update (if any) and the active vessel trip update (if any).
    return {
      vesselAbbrev: currLocation.VesselAbbrev,
      existingVesselTrip: prevTrip,
      activeVesselTrip,
      completedVesselTrip,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[updateVesselTrip] failed trip update", {
      vesselAbbrev: currLocation.VesselAbbrev,
      locationTimeStamp: currLocation.TimeStamp,
      existingTripKey: prevTrip?.TripKey,
      existingScheduleKey: prevTrip?.ScheduleKey,
      message: err.message,
      stack: err.stack,
    });
    return null;
  }
};

/**
 * Returns whether the incoming ping starts a new trip leg.
 *
 * The trip pipeline treats a departing terminal change as the durable rollover
 * signal. This keeps completion and replacement row construction anchored to a
 * physical terminal transition rather than schedule field availability.
 *
 * @param prevTrip - Stored active trip row for the vessel, if present
 * @param currLocation - Current location ping for the same vessel
 * @returns True when the stored departing terminal differs from the ping
 */
const startsNewTripLeg = (
  prevTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation
): boolean =>
  prevTrip !== undefined &&
  prevTrip.DepartingTerminalAbbrev !== currLocation.DepartingTerminalAbbrev;

export { updateVesselTrip };
