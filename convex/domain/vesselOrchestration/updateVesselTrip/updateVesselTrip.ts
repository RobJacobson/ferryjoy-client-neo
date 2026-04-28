/**
 * Per-vessel trip update computation from one location ping.
 */

import { areTripStorageRowsEqual } from "domain/vesselOrchestration/shared";
import type { ScheduleDbAccess } from "domain/vesselOrchestration/shared/scheduleAccess";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { detectTripEvents } from "./lifecycle";
import { buildUpdatedVesselRows } from "./tripBuilders";
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
    const shouldWriteActiveTrip = isUpdatedVesselTrip(
      input.existingActiveTrip,
      activeVesselTrip
    );

    const result: VesselTripUpdate = {
      vesselAbbrev: input.vesselLocation.VesselAbbrev,
      existingActiveTrip: input.existingActiveTrip,
      activeVesselTripUpdate: shouldWriteActiveTrip
        ? activeVesselTrip
        : undefined,
      completedVesselTripUpdate: completedVesselTrip,
    };
    if (
      result.activeVesselTripUpdate === undefined &&
      result.completedVesselTripUpdate === undefined
    ) {
      return null;
    }
    return result;
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

/**
 * Checks whether an active trip candidate has a meaningful storage change.
 *
 * @param existingActiveTrip - Current active trip row, if present
 * @param activeTripCandidate - Candidate active trip row from domain compute
 * @returns True when the active row should be persisted
 */
export const isUpdatedVesselTrip = (
  existingActiveTrip: ConvexVesselTrip | undefined,
  activeTripCandidate: ConvexVesselTrip | undefined
): boolean => !areTripStorageRowsEqual(existingActiveTrip, activeTripCandidate);

export { updateVesselTrip };
