/**
 * Segment leg derived state for ScheduledTrips timeline.
 * Computes display-oriented state (predictions, past-tense flags) from segment,
 * vesselLocation, and actual/prev/prediction trips. Used by pipeline and by
 * ScheduledTripLeg when legState is not pre-computed.
 */

import type { VesselLocation } from "convex/functions/vesselLocation/schemas";
import type { VesselTrip } from "convex/functions/vesselTrips/schemas";
import { getSailingDay } from "@/shared/utils/getSailingDay";
import {
  getBestArrivalTime,
  getBestDepartureTime,
  getBestNextDepartureTime,
  getPredictedArriveNextTime,
} from "../../Timeline/utils";
import type { Segment } from "../types";

// ============================================================================
// Types
// ============================================================================

export type SegmentLegDerivedState = {
  isHistoricalMatch: boolean;
  /** True when we should show actualTrip.TripStart as actual arrival (on same sailing day). */
  showOriginActualTime: boolean;
  /**
   * Predicted arrival time at the segment's *origin* (DepartingTerminalAbbrev).
   * Used when segment has no actualTrip but vessel's current trip predicts arrive-next.
   */
  originArrivePrediction: Date | undefined;
  departurePrediction: Date | undefined;
  arrivalPrediction: Date | undefined;
  departNextPrediction: Date | undefined;
  originArriveInPast: boolean;
  departInPast: boolean;
  destArriveInPast: boolean;
};

// ============================================================================
// API
// ============================================================================

/**
 * Computes display-oriented derived state for a scheduled segment leg.
 * - isHistoricalMatch when actualTrip exists for this segment Key
 * - predictions from VesselLocation + actualTrip; past-tense flags for labels
 *
 * @param segment - The segment (leg) being rendered
 * @param vesselLocation - Real-time vessel data when available; null for schedule-only
 * @param actualTrip - Actual/predicted trip for this segment Key
 * @param prevActualTrip - Trip for previous leg (depart-next prediction)
 * @param predictionTrip - Trip used for arrive-next on first segment (e.g. inbound)
 * @param nowMs - Current time for past-tense checks
 * @returns Derived state for ScheduledTripLeg
 */
export const getSegmentLegDerivedState = (
  segment: Segment,
  vesselLocation: VesselLocation | null | undefined,
  actualTrip: VesselTrip | undefined,
  prevActualTrip: VesselTrip | undefined,
  predictionTrip: VesselTrip | undefined,
  nowMs = Date.now()
): SegmentLegDerivedState => {
  const isHistoricalMatch = actualTrip !== undefined;

  // Predictions from Timeline utils; depart-next uses previous (or prediction) trip.
  const departurePrediction = getBestDepartureTime(
    vesselLocation ?? undefined,
    actualTrip
  );
  const arrivalPrediction = getBestArrivalTime(
    vesselLocation ?? undefined,
    actualTrip
  );
  const departNextPrediction = getBestNextDepartureTime(
    prevActualTrip ?? predictionTrip
  );

  const originArrivePrediction =
    !isHistoricalMatch &&
    vesselLocation &&
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

  // Past-tense flags for label ("Arrived" vs "Arrive", etc.) and styling.
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
