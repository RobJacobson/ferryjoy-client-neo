/**
 * Per-vessel trip update computation from one location ping.
 */

import { isSameVesselTrip } from "domain/vesselOrchestration/shared";
import type { ScheduleDbAccess } from "domain/vesselOrchestration/shared/scheduleAccess";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { buildUpdatedVesselRows } from "./tripBuilders";
import { detectTripEvents } from "./tripEvents";
import type { VesselTripUpdate } from "./types";

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
  scheduleAccess: ScheduleDbAccess
): Promise<VesselTripUpdate | null> => {
  try {
    // Detect lifecycle transitions before mutating trip rows.
    const events = detectTripEvents(existingActiveTrip, vesselLocation);

    // Build candidate rows from lifecycle and schedule evidence.
    const { activeVesselTrip, completedVesselTrip } =
      await buildUpdatedVesselRows(
        {
          vesselLocation,
          existingActiveTrip,
          events,
        },
        scheduleAccess
      );

    // Check if the active vessel trip has meaningfully changed.
    const isActiveVesselTripUnchanged = isSameVesselTrip(
      existingActiveTrip,
      activeVesselTrip
    );

    // If the active vessel trip is unchanged, return null.
    if (isActiveVesselTripUnchanged) {
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
