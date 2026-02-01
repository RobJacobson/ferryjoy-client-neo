/**
 * Timeline utility functions for time selection and trip data processing.
 */

import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import type { TimelineBarStatus } from "./TimelineBar";

/**
 * Gets the departure time for a trip, prioritizing actual over predicted over scheduled.
 * Used for progress bar start times when vessel is at sea.
 *
 * @param trip - The vessel trip object
 * @returns Departure time Date, or undefined if none available
 */
export const getDepartureTime = (trip: VesselTrip): Date | undefined =>
  trip.LeftDock || trip.AtDockDepartCurr?.PredTime || trip.ScheduledDeparture;

/**
 * Gets the arrival time for a trip, prioritizing ETA over predicted times.
 *
 * @param trip - The vessel trip object
 * @returns Arrival time Date, or undefined if none available
 */
export const getArrivalTime = (trip: VesselTrip): Date | undefined =>
  trip.Eta || trip.AtSeaArriveNext?.PredTime || trip.AtDockArriveNext?.PredTime;

/**
 * Calculates progress for a timeline bar based on status and time values.
 * Returns a progress value between 0 and 1.
 *
 * @param status - Timeline bar status (Pending, InProgress, Completed)
 * @param nowMs - Current time in milliseconds
 * @param startTimeMs - Start time in milliseconds
 * @param endTimeMs - End time in milliseconds
 * @returns Progress value (0 to 1), defaults to 0 if not calculable
 */
export const calculateTimeProgress = ({
  status,
  nowMs,
  startTimeMs,
  endTimeMs,
}: {
  status: TimelineBarStatus;
  nowMs: number;
  startTimeMs?: number;
  endTimeMs?: number;
}): number => {
  if (status === "Pending") {
    return 0;
  }

  if (status === "Completed") {
    return 1;
  }

  if (
    startTimeMs === undefined ||
    endTimeMs === undefined ||
    nowMs < startTimeMs
  ) {
    return 0;
  }

  const duration = endTimeMs - startTimeMs;
  if (duration <= 0) {
    return 0;
  }

  const elapsed = nowMs - startTimeMs;
  return Math.min(1, Math.max(0, elapsed / duration));
};

/**
 * Calculates minutes remaining until end time.
 *
 * @param nowMs - Current time in milliseconds
 * @param endTimeMs - End time in milliseconds
 * @returns Minutes remaining, or undefined if not calculable
 */
export const getMinutesRemaining = ({
  nowMs,
  endTimeMs,
}: {
  nowMs: number;
  endTimeMs?: number;
}): number | undefined => {
  if (endTimeMs === undefined) {
    return undefined;
  }

  const remainingMs = endTimeMs - nowMs;
  if (remainingMs <= 0) {
    return 0;
  }

  return Math.round(remainingMs / (1000 * 60));
};
