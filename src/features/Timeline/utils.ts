/**
 * Timeline utility functions for time selection and trip data processing.
 */

import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import type { TimelineBarStatus } from "./TimelineBar";

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
 * Gets the departure time for a trip using resolved predictions.
 *
 * @param trip - The vessel trip object
 * @returns Departure time Date, or undefined if none available
 */
export const getDepartureTime = (trip: VesselTrip): Date | undefined =>
  trip.predictions.departCurr?.time;

/**
 * Gets the arrival time for a trip using resolved predictions.
 *
 * @param trip - The vessel trip object
 * @returns Arrival time Date, or undefined if none available
 */
export const getArrivalTime = (trip: VesselTrip): Date | undefined =>
  trip.predictions.arriveNext?.time;

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
  // 1. Calculate Duration (FlexGrow)
  // We always use scheduled times for the layout width to keep the timeline consistent
  const durationMs =
    startTimeMs !== undefined && endTimeMs !== undefined
      ? Math.max(MS_PER_MINUTE * 5, endTimeMs - startTimeMs) // Minimum 5 minutes for spacing
      : undefined;
  const duration =
    durationMs !== undefined
      ? Math.round((durationMs / MS_PER_MINUTE) * 100) / 100
      : undefined;

  // 2. Calculate Minutes Remaining
  // Use prediction if available, otherwise scheduled end time
  const effectiveEndTimeMs = predictionEndTimeMs ?? endTimeMs;
  const remainingMs =
    effectiveEndTimeMs !== undefined ? effectiveEndTimeMs - nowMs : undefined;

  // For in-progress segments, we want to show the minutes remaining until the effective end time.
  // If the vessel is past the effective end time, we show 0 or 1 depending on whether it's arrived.
  const minutesRemaining =
    status === "InProgress" && remainingMs !== undefined
      ? Math.max(0, Math.ceil(remainingMs / MS_PER_MINUTE))
      : undefined;

  // 3. Calculate Progress (0-1)
  // If we have a prediction and it's later than scheduled, use it to calculate progress
  // so the bar doesn't hit 100% prematurely.
  const progressDurationMs =
    startTimeMs !== undefined && effectiveEndTimeMs !== undefined
      ? Math.max(durationMs ?? 0, effectiveEndTimeMs - startTimeMs)
      : durationMs;

  let progress = 0;
  if (status === "Completed") {
    progress = 1;
  } else if (
    status === "InProgress" &&
    progressDurationMs !== undefined &&
    progressDurationMs > 0 &&
    startTimeMs !== undefined &&
    nowMs >= startTimeMs
  ) {
    progress = Math.min(
      0.99,
      Math.max(0, (nowMs - startTimeMs) / progressDurationMs)
    );
  }

  // Final safety check: if the status is not Completed, and the current time is before the start time,
  // progress must be 0, regardless of what the math says.
  if (
    status !== "Completed" &&
    startTimeMs !== undefined &&
    nowMs < startTimeMs
  ) {
    progress = 0;
  }

  // CRITICAL: If status is Pending, progress MUST be 0.
  if (status === "Pending") {
    progress = 0;
  }

  // Double-check: if the vessel is NOT at the terminal for an at-dock segment,
  // it should not have progress.
  if (
    status === "InProgress" &&
    startTimeMs !== undefined &&
    nowMs < startTimeMs
  ) {
    progress = 0;
  }

  return {
    progress,
    minutesRemaining,
    duration,
  };
};
