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

type UpdateVesselTripInput = {
  vesselLocation: ConvexVesselLocation;
  existingActiveTrip?: ConvexVesselTrip;
  scheduleAccess: ScheduleDbAccess;
};

/**
 * Computes storage and lifecycle changes for one vessel ping.
 *
 * @param input - Vessel location, optional active trip, and schedule lookup tables
 * @returns Trip update when substantive changes exist, otherwise `null`
 */
const updateVesselTrip = async (
  input: UpdateVesselTripInput
): Promise<VesselTripUpdate | null> => {
  try {
    // Detect lifecycle transitions before mutating trip rows.
    const events = detectTripEvents(
      input.existingActiveTrip,
      input.vesselLocation
    );

    // Build candidate rows from lifecycle and schedule evidence.
    const { activeVesselTrip, completedVesselTrip } =
      await buildUpdatedVesselRows(
        {
          vesselLocation: input.vesselLocation,
          existingActiveTrip: input.existingActiveTrip,
          events,
        },
        input.scheduleAccess
      );

    // Check if the active vessel trip has meaningfully changed.
    const isActiveVesselTripUnchanged = isSameVesselTrip(
      input.existingActiveTrip,
      activeVesselTrip
    );

    // If the active vessel trip is unchanged, return null.
    if (isActiveVesselTripUnchanged) {
      return null;
    }

    // Return the completed vessel trip update (if any) and the active vessel trip update (if any).
    return {
      vesselAbbrev: input.vesselLocation.VesselAbbrev,
      existingActiveTrip: input.existingActiveTrip,
      activeVesselTripUpdate: activeVesselTrip,
      completedVesselTripUpdate: completedVesselTrip,
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error("[updateVesselTrip] failed trip update", {
      vesselAbbrev: input.vesselLocation.VesselAbbrev,
      locationTimeStamp: input.vesselLocation.TimeStamp,
      existingTripKey: input.existingActiveTrip?.TripKey,
      existingScheduleKey: input.existingActiveTrip?.ScheduleKey,
      message: err.message,
      stack: err.stack,
    });
    return null;
  }
};

export { updateVesselTrip };
