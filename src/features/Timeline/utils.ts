/**
 * Timeline utility functions for time selection and trip data processing.
 */

import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import type { TimelineBarStatus } from "./TimelineBar";

const MS_PER_MINUTE = 60000;

/**
 * Gets the departure time for a trip, prioritizing actual over predicted over scheduled.
 * Used for progress bar start times when vessel is at sea.
 *
 * @param trip - The vessel trip object
 * @returns Departure time Date, or undefined if none available
 */
export const getDepartureTime = (trip: VesselTrip): Date | undefined =>
  trip.LeftDock ?? trip.AtDockDepartCurr?.PredTime ?? trip.ScheduledDeparture;

/**
 * Gets the arrival time for a trip, prioritizing ETA over predicted times.
 *
 * @param trip - The vessel trip object
 * @returns Arrival time Date, or undefined if none available
 */
export const getArrivalTime = (trip: VesselTrip): Date | undefined =>
  trip.Eta ?? trip.AtSeaArriveNext?.PredTime ?? trip.AtDockArriveNext?.PredTime;

/**
 * Computes all layout and progress data for a timeline bar in one go.
 * Consolidates duration, progress, and remaining time calculations.
 *
 * @param status - Timeline bar status
 * @param nowMs - Current time in milliseconds
 * @param startTimeMs - Start time in milliseconds
 * @param endTimeMs - End time in milliseconds
 * @returns Object containing progress, minutesRemaining, and flexGrow
 */
export const getTimelineLayout = ({
  status,
  nowMs,
  startTimeMs,
  endTimeMs,
}: {
  status: TimelineBarStatus;
  nowMs: number;
  startTimeMs?: number;
  endTimeMs?: number;
}) => {
  // 1. Calculate Duration (FlexGrow)
  const durationMs =
    startTimeMs !== undefined && endTimeMs !== undefined
      ? endTimeMs - startTimeMs
      : undefined;
  const duration =
    durationMs !== undefined
      ? Math.round((durationMs / MS_PER_MINUTE) * 100) / 100
      : undefined;

  // 2. Calculate Minutes Remaining
  const remainingMs = endTimeMs !== undefined ? endTimeMs - nowMs : undefined;
  const minutesRemaining =
    remainingMs !== undefined
      ? Math.max(0, Math.ceil(remainingMs / MS_PER_MINUTE))
      : undefined;

  // 3. Calculate Progress (0-1)
  const progress =
    status === "Completed"
      ? 1
      : status === "InProgress" && duration !== undefined && duration > 0
        ? Math.min(
            1,
            // biome-ignore lint/style/noNonNullAssertion: duration > 0 implies durationMs is defined
            Math.max(0, (nowMs - (startTimeMs ?? 0)) / durationMs!)
          )
        : 0;

  return {
    progress,
    minutesRemaining,
    duration,
  };
};
