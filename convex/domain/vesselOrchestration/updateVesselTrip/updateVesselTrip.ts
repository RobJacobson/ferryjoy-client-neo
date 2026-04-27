/**
 * Per-vessel trip update computation from one location ping.
 */

import { areTripStorageRowsEqual } from "domain/vesselOrchestration/shared";
import type { ScheduleContinuityAccess } from "domain/vesselOrchestration/shared/scheduleContinuity";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { detectTripEvents } from "./lifecycle";
import { buildUpdatedVesselRows } from "./tripBuilders";
import type { TripFieldInferenceInput } from "./tripFields";
import type { VesselTripUpdate } from "./types";

type UpdateVesselTripInput = {
  vesselLocation: ConvexVesselLocation;
  existingActiveTrip?: ConvexVesselTrip;
  scheduleAccess: ScheduleContinuityAccess;
  /**
   * Optional observability hook after current-trip fields resolve (before
   * next-leg attachment). Wired from the orchestrator for diagnostics; schedule
   * continuity behavior is unchanged when omitted.
   */
  onTripFieldsResolved?: (args: TripFieldInferenceInput) => void;
};

/**
 * Computes storage and lifecycle changes for one vessel ping.
 *
 * @param input - Vessel location, optional active trip, and schedule lookup tables
 * @returns Trip update when substantive changes exist, otherwise `null`
 */
export const updateVesselTrip = async (
  input: UpdateVesselTripInput
): Promise<VesselTripUpdate | null> => {
  try {
    // Detect lifecycle transitions before mutating trip rows.
    const events = detectTripEvents(
      input.existingActiveTrip,
      input.vesselLocation
    );
    // Build candidate rows from lifecycle and schedule evidence.
    const tripRows = await buildUpdatedVesselRows(
      {
        vesselLocation: input.vesselLocation,
        existingActiveTrip: input.existingActiveTrip,
        events,
      },
      input.scheduleAccess,
      input.onTripFieldsResolved
    );
    const activeTripCandidate = tripRows.activeVesselTrip;
    const shouldWriteActiveTrip = !areTripStorageRowsEqual(
      input.existingActiveTrip,
      activeTripCandidate
    );

    const result: VesselTripUpdate = {
      vesselAbbrev: input.vesselLocation.VesselAbbrev,
      existingActiveTrip: input.existingActiveTrip,
      activeVesselTripUpdate:
        shouldWriteActiveTrip && activeTripCandidate !== undefined
          ? activeTripCandidate
          : undefined,
      completedVesselTripUpdate: tripRows.completedVesselTrip,
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
