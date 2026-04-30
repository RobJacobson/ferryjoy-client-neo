/**
 * Per-vessel trip update computation from one location ping.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { buildActiveTrip } from "./buildActiveTrip";
import { completeTrip } from "./completeTrip";
import { isNewTrip } from "./lifecycleSignals";
import { applyScheduleForActiveTrip } from "./scheduleForActiveTrip";
import { isSameVesselTrip } from "./tripComparison";
import type { UpdateVesselTripDbAccess, VesselTripUpdate } from "./types";

/**
 * Computes storage and lifecycle changes for one vessel ping.
 *
 * @param vesselLocation - Latest location ping for one vessel
 * @param existingActiveTrip - Existing active trip row for that vessel, when present
 * @param scheduleAccess - Schedule lookup tables used to enrich trip fields
 * @returns Trip update when substantive changes exist, otherwise `null`
 */
const updateVesselTrip = async (
  vesselLocation: ConvexVesselLocation,
  existingActiveTrip: ConvexVesselTrip | undefined,
  dbAccess: UpdateVesselTripDbAccess
): Promise<VesselTripUpdate | null> => {
  try {
    const hasNewTripSignal = isNewTrip(existingActiveTrip, vesselLocation);
    const completedVesselTrip =
      hasNewTripSignal && existingActiveTrip !== undefined
        ? completeTrip(existingActiveTrip, vesselLocation)
        : undefined;

    const baseActiveTrip = buildActiveTrip({
      previousTrip: existingActiveTrip,
      completedTrip: completedVesselTrip,
      location: vesselLocation,
      isNewTrip: hasNewTripSignal,
    });

    const activeVesselTrip = await applyScheduleForActiveTrip({
      activeTrip: baseActiveTrip,
      previousTrip: existingActiveTrip,
      completedTrip: completedVesselTrip,
      location: vesselLocation,
      isNewTrip: hasNewTripSignal,
      dbAccess,
    });

    // Check if the active vessel trip has meaningfully changed.
    const isActiveVesselTripUnchanged = isSameVesselTrip(
      existingActiveTrip,
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
