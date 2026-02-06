/**
 * Timeline utility functions for time selection and trip data processing.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import { getSailingDay } from "@/shared/utils/getSailingDay";
import type { TimelineBarStatus } from "./TimelineBar";
import type { Segment } from "./types";

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
 *
 * @param trip - The vessel trip object
 * @returns Arrival time Date, or undefined if none available
 */
export const getPredictedArriveNextTime = (
  trip: VesselTrip,
  vesselLocation: VesselLocation
): Date | undefined =>
  vesselLocation.Eta ??
  trip.AtSeaArriveNext?.PredTime ??
  trip.AtDockArriveNext?.PredTime;

/**
 * Gets departure time for the next segment of the trip using predicted departure time.
 *
 * @param trip - The vessel trip object
 * @returns Departure time Date, or undefined if none available
 */
export const getPredictedDepartNextTime = (
  trip: VesselTrip
): Date | undefined =>
  trip.AtSeaDepartNext?.PredTime ?? trip.AtDockDepartNext?.PredTime;

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
 * Derived state for TimelineSegmentLeg.
 * All values computed from segment, vesselLocation, actualTrip, and prevActualTrip.
 */
export type SegmentLegDerivedState = {
  isHistoricalMatch: boolean;
  /** True when we should show actualTrip.TripStart as actual arrival (on same sailing day). */
  showOriginActualTime: boolean;
  /**
   * Predicted arrival time at the segment's *origin* (DepartingTerminalAbbrev).
   *
   * This is primarily used for direct scheduled segments that have an `Arrive <origin>`
   * marker (via `SchedArriveCurr`) but do not yet have a matching `actualTrip` record.
   * In that case, the prediction typically lives on the vessel's current trip (arrive-next),
   * not on the upcoming scheduled segment's key.
   */
  originArrivePrediction: Date | undefined;
  departurePrediction: Date | undefined;
  arrivalPrediction: Date | undefined;
  departNextPrediction: Date | undefined;
  originArriveInPast: boolean;
  departInPast: boolean;
  destArriveInPast: boolean;
};

/**
 * Computes all derived state for a timeline segment leg.
 *
 * This is intentionally *display-oriented* derived state:
 * - `isHistoricalMatch` is true when an `actualTrip` exists for this segment Key
 * - predictions are computed from VesselLocation + actualTrip fields
 * - past-tense flags control label wording only (not segment completion state)
 *
 * @param segment - The segment (leg) being rendered
 * @param vesselLocation - Real-time WSF vessel data (PRIMARY source)
 * @param actualTrip - Actual/predicted trip record for this segment Key (SECONDARY)
 * @param prevActualTrip - Actual/predicted trip for previous leg (for depart-next prediction)
 * @param nowMs - Current time for past-tense checks (defaults to Date.now())
 * @returns Derived state object for TimelineSegmentLeg
 */
export const getSegmentLegDerivedState = (
  segment: Segment,
  vesselLocation: VesselLocation,
  actualTrip: VesselTrip | undefined,
  prevActualTrip: VesselTrip | undefined,
  predictionTrip: VesselTrip | undefined,
  nowMs = Date.now()
): SegmentLegDerivedState => {
  const isHistoricalMatch = actualTrip !== undefined;

  const departurePrediction = getBestDepartureTime(vesselLocation, actualTrip);
  const arrivalPrediction = getBestArrivalTime(vesselLocation, actualTrip);
  const departNextPrediction = getBestNextDepartureTime(
    prevActualTrip ?? predictionTrip
  );

  const originArrivePrediction =
    !isHistoricalMatch &&
    !vesselLocation.AtDock &&
    predictionTrip &&
    vesselLocation.ArrivingTerminalAbbrev === segment.DepartingTerminalAbbrev
      ? getPredictedArriveNextTime(predictionTrip, vesselLocation)
      : undefined;

  const showOriginActualTime = !!(
    isHistoricalMatch &&
    actualTrip?.TripStart &&
    (!segment.SailingDay ||
      getSailingDay(actualTrip.TripStart) === segment.SailingDay)
  );

  const originArriveInPast =
    (isHistoricalMatch && !!actualTrip?.LeftDock) ||
    (segment.SchedArriveCurr != null &&
      segment.SchedArriveCurr.getTime() < nowMs);
  const departInPast =
    (isHistoricalMatch && !!actualTrip?.LeftDock) ||
    segment.DepartingTime.getTime() < nowMs;
  const destArriveInPast =
    (isHistoricalMatch && !!actualTrip?.TripEnd) ||
    (segment.SchedArriveNext != null &&
      segment.SchedArriveNext.getTime() < nowMs);

  return {
    isHistoricalMatch,
    showOriginActualTime,
    originArrivePrediction,
    departurePrediction,
    arrivalPrediction,
    departNextPrediction,
    originArriveInPast,
    departInPast,
    destArriveInPast,
  };
};

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
    effectiveEndTimeMs !== undefined &&
    nowMs >= startTimeMs
  ) {
    const progressDurationMs = Math.max(
      durationMs ?? 0,
      effectiveEndTimeMs - startTimeMs
    );
    if (progressDurationMs > 0) {
      progress = Math.min(1, (nowMs - startTimeMs) / progressDurationMs);
    }
  }

  return {
    progress,
    minutesRemaining,
    duration,
  };
};
