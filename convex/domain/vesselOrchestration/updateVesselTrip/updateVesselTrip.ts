/**
 * Per-vessel trip update computation from one location ping.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { buildActiveTrip } from "./pipeline/buildActiveTrip";
import { buildCompleteTrip } from "./pipeline/buildCompleteTrip";
import * as lifecycle from "./pipeline/lifecycleSignals";
import { isSameVesselTrip } from "./pipeline/tripComparison";
import { applyScheduleForActiveTrip } from "./schedule/scheduleForActiveTrip";
import type { UpdateVesselTripDbAccess, VesselTripUpdate } from "./types";

/**
 * Computes storage and lifecycle changes for one vessel ping.
 *
 * @param currLocation - Latest location ping for one vessel
 * @param prevTrip - Existing active trip row for that vessel, when present
 * @param dbAccess - Schedule tables used to enrich new-trip rows (see
 *   applyScheduleForActiveTrip); not consulted on every ping.
 * @returns Trip update when substantive changes exist, otherwise `null`
 */
const updateVesselTrip = async (
  currLocation: ConvexVesselLocation,
  prevTrip: ConvexVesselTrip | undefined,
  dbAccess: UpdateVesselTripDbAccess
): Promise<VesselTripUpdate | null> => {
  try {
    // Extract continuity context from the prior active trip row.
    const isNewTrip = lifecycle.isNewTrip(prevTrip, currLocation);
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

    // Schedule-table reads (inside applyScheduleForActiveTrip) run only on new
    // trip rollover while InService; WSF pings use a sync merge path instead.
    const activeVesselTrip = await applyScheduleForActiveTrip({
      activeTrip,
      prevTrip: prevTrip,
      currLocation: currLocation,
      isNewTrip,
      dbAccess,
    });

    // Check if the active vessel trip has meaningfully changed.
    const isActiveVesselTripUnchanged = isSameVesselTrip(
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

export { updateVesselTrip };
