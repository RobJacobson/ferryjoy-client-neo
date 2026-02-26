/**
 * Timeline utility functions for time selection and trip data processing.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import type { TimelineBarStatus } from "../TimelineBar";

const MS_PER_MINUTE = 60000;

/**
 * Creates a Map of VesselTrips indexed by their unique Key for O(1) lookup.
 *
 * @param trips - Array of vessel trips to index
 * @returns Map of trip Key to VesselTrip object
 */
export const createVesselTripMap = (
  trips: VesselTrip[]
): Map<string, VesselTrip> => {
  const map = new Map<string, VesselTrip>();
  for (const trip of trips) {
    if (trip.Key) {
      map.set(trip.Key, trip);
    }
  }
  return map;
};

/**
 * Gets the departure time for the current segment of the trip using predicted departure time.
 *
 * @param trip - The vessel trip object
 * @returns Departure time Date, or undefined if none available
 */
export const getPredictedDepartCurrTime = (
  trip: VesselTrip
): Date | undefined => trip.AtDockDepartCurr?.PredTime;

/**
 * Gets arrival time for the next segment of the trip using predicted arrival time.
 * Returns undefined when trip or vesselLocation is missing.
 *
 * @param trip - The vessel trip object (optional)
 * @param vesselLocation - VesselLocation with Eta (optional)
 * @returns Arrival time Date, or undefined if none available or inputs missing
 */
export const getPredictedArriveNextTime = (
  trip: VesselTrip | undefined,
  vesselLocation: VesselLocation | undefined
): Date | undefined =>
  vesselLocation?.Eta ??
  trip?.AtSeaArriveNext?.PredTime ??
  trip?.AtDockArriveNext?.PredTime;

/**
 * Gets the best available departure time for a trip.
 *
 * Priority:
 * 1. VesselLocation.LeftDock (WSF actual departure)
 * 2. VesselTrip.LeftDock (ML actual departure)
 * 3. VesselTrip.AtDockDepartCurr (ML prediction at dock)
 *
 * @param vesselLocation - VesselLocation with WSF data
 * @param trip - VesselTrip with ML predictions
 * @returns Best available departure time
 */
export const getBestDepartureTime = (
  vesselLocation: VesselLocation | undefined,
  trip: VesselTrip | undefined
): Date | undefined =>
  vesselLocation?.LeftDock ??
  trip?.LeftDock ??
  trip?.AtDockDepartCurr?.PredTime;

/**
 * Gets the best available arrival time for a trip.
 *
 * Priority:
 * 1. VesselTrip.TripEnd (WSF actual arrival)
 * 2. VesselLocation.Eta (WSF at-sea prediction)
 * 3. VesselTrip.AtSeaArriveNext (ML at-sea prediction)
 * 4. VesselTrip.AtDockArriveNext (ML at-dock prediction)
 *
 * @param vesselLocation - VesselLocation with WSF data
 * @param trip - VesselTrip with ML predictions
 * @returns Best available arrival time
 */
export const getBestArrivalTime = (
  vesselLocation: VesselLocation | undefined,
  trip: VesselTrip | undefined
): Date | undefined =>
  trip?.TripEnd ??
  vesselLocation?.Eta ??
  trip?.AtSeaArriveNext?.PredTime ??
  trip?.AtDockArriveNext?.PredTime;

/**
 * Gets the best available next departure time.
 *
 * Priority:
 * 1. VesselTrip.AtSeaDepartNext (ML at-sea prediction)
 * 2. VesselTrip.AtDockDepartNext (ML at-dock prediction)
 *
 * @param trip - VesselTrip with ML predictions
 * @returns Best available next departure time
 */
export const getBestNextDepartureTime = (
  trip: VesselTrip | undefined
): Date | undefined =>
  trip?.AtSeaDepartNext?.PredTime ?? trip?.AtDockDepartNext?.PredTime;

/**
 * Computes all layout and progress data for a timeline bar in one go.
 * Consolidates duration, progress, and remaining time calculations.
 *
 * @param status - Timeline bar status
 * @param nowMs - Current time in milliseconds
 * @param startTimeMs - Start time in milliseconds
 * @param endTimeMs - End time in milliseconds
 * @param predictionEndTimeMs - Optional predicted end time in milliseconds
 * @returns Object containing progress, minutesRemaining, and flexGrow
 */
export const getTimelineLayout = ({
  status,
  nowMs,
  startTimeMs,
  endTimeMs,
  predictionEndTimeMs,
}: {
  status: TimelineBarStatus;
  nowMs: number;
  startTimeMs?: number;
  endTimeMs?: number;
  predictionEndTimeMs?: number;
}) => {
  // 1. Primary Guard: If status is Pending, progress MUST be 0.
  if (status === "Pending") {
    return {
      progress: 0,
      minutesRemaining: undefined,
      duration:
        startTimeMs !== undefined && endTimeMs !== undefined
          ? Math.round(
              (Math.max(MS_PER_MINUTE * 5, endTimeMs - startTimeMs) /
                MS_PER_MINUTE) *
                100
            ) / 100
          : undefined,
    };
  }

  // 2. Calculate Duration (FlexGrow)
  // We always use scheduled times for the layout width to keep the timeline consistent
  const durationMs =
    startTimeMs !== undefined && endTimeMs !== undefined
      ? Math.max(MS_PER_MINUTE * 5, endTimeMs - startTimeMs) // Minimum 5 minutes for spacing
      : undefined;
  const duration =
    durationMs !== undefined
      ? Math.round((durationMs / MS_PER_MINUTE) * 100) / 100
      : undefined;

  // 3. Calculate Minutes Remaining
  // Use prediction if available, otherwise scheduled end time
  const effectiveEndTimeMs = predictionEndTimeMs ?? endTimeMs;
  const remainingMs =
    effectiveEndTimeMs !== undefined ? effectiveEndTimeMs - nowMs : undefined;

  // For in-progress segments, we want to show the minutes remaining until the effective end time.
  const minutesRemaining =
    status === "InProgress" && remainingMs !== undefined
      ? Math.max(0, Math.ceil(remainingMs / MS_PER_MINUTE))
      : undefined;

  // 4. Calculate Progress (0-1)
  let progress = 0;

  if (status === "Completed") {
    progress = 1;
  } else if (
    status === "InProgress" &&
    startTimeMs !== undefined &&
    effectiveEndTimeMs !== undefined
  ) {
    // If we haven't reached the start time yet, progress is 0.
    // This handles the "Arrived at dock but scheduled departure is in the future" case.
    if (nowMs < startTimeMs) {
      progress = 0;
    } else {
      const progressDurationMs = Math.max(
        durationMs ?? 0,
        effectiveEndTimeMs - startTimeMs
      );
      if (progressDurationMs > 0) {
        progress = Math.min(1, (nowMs - startTimeMs) / progressDurationMs);
      }
    }
  }

  return {
    progress,
    minutesRemaining,
    duration,
  };
};
