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
 * @param vesselLocation - Latest location ping for one vessel
 * @param existingActiveTrip - Existing active trip row for that vessel, when present
 * @param dbAccess - Schedule tables used to enrich new-trip rows (see
 *   applyScheduleForActiveTrip); not consulted on every ping.
 * @returns Trip update when substantive changes exist, otherwise `null`
 */
const updateVesselTrip = async (
  vesselLocation: ConvexVesselLocation,
  existingActiveTrip: ConvexVesselTrip | undefined,
  dbAccess: UpdateVesselTripDbAccess
): Promise<VesselTripUpdate | null> => {
  try {
    // Extract continuity context from the prior active trip row.
    const prev = existingActiveTrip;
    const curr = vesselLocation;
    const isNewTrip = lifecycle.isNewTrip(prev, curr);
    const completedVesselTrip =
      isNewTrip && prev !== undefined
        ? buildCompleteTrip(prev, curr)
        : undefined;

    // Build the active trip row for this ping.
    const activeTrip = buildActiveTrip({
      prev,
      completedVesselTrip,
      curr,
      isNewTrip,
    });

    // Schedule-table reads (inside applyScheduleForActiveTrip) run only on new
    // trip rollover while InService; WSF pings use a sync merge path instead.
    const activeVesselTrip = await applyScheduleForActiveTrip({
      activeTrip,
      prev,
      location: curr,
      isNewTrip,
      dbAccess,
    });

    // Check if the active vessel trip has meaningfully changed.
    const isActiveVesselTripUnchanged = isSameVesselTrip(
      prev,
      activeVesselTrip
    );

    // Suppress no-op active-only updates but always emit completion rollover.
    if (completedVesselTrip === undefined && isActiveVesselTripUnchanged) {
      return null;
    }

    // Return the completed vessel trip update (if any) and the active vessel trip update (if any).
    return {
      vesselAbbrev: vesselLocation.VesselAbbrev,
      existingActiveTrip,
      activeVesselTripUpdate: activeVesselTrip,
      completedVesselTripUpdate: completedVesselTrip,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[updateVesselTrip] failed trip update", {
      vesselAbbrev: vesselLocation.VesselAbbrev,
      locationTimeStamp: vesselLocation.TimeStamp,
      existingTripKey: existingActiveTrip?.TripKey,
      existingScheduleKey: existingActiveTrip?.ScheduleKey,
      message: err.message,
      stack: err.stack,
    });
    return null;
  }
};

export { updateVesselTrip };
