/**
 * Model-building hook for TripProgressMeter.
 * Encapsulates time selection.
 */

import type { VesselTrip } from "@/data/contexts/convex/ConvexVesselTripsContext";

// ============================================================================
// Types
// ============================================================================

export type TripProgressMeterModel = {
  arriveATimeMs?: number;
  departATimeMs?: number;
  arriveBTimeMs?: number;
  isAtDock: boolean;
};

// ============================================================================
// Hook
// ============================================================================

/**
 * Builds the display model for TripProgressMeter.
 *
 * @param trip - VesselTrip object containing actual, predicted, and scheduled timing data
 * @returns Model containing computed times and indicator positioning
 */
export const useTripProgressMeterModel = (
  trip: VesselTrip
): TripProgressMeterModel => {
  // Extract and prioritize time values: actual > predicted > scheduled
  const arriveATimeMs = trip.TripStart?.getTime();
  const departATimeMs = getBestTimeMs(
    trip.LeftDock,
    trip.AtDockDepartCurr?.PredTime,
    trip.ScheduledDeparture
  );
  const arriveBTimeMs = getBestTimeMs(
    trip.TripEnd,
    trip.AtSeaArriveNext?.PredTime,
    trip.Eta
  );

  return {
    arriveATimeMs,
    departATimeMs,
    arriveBTimeMs,
    isAtDock: trip.AtDock,
  };
};

// ============================================================================
// Helpers
// ============================================================================

/**
 * Picks the best time value (actual > predicted > scheduled) as epoch ms.
 *
 * @param actual - Actual time value
 * @param predicted - Predicted time value
 * @param scheduled - Scheduled time value
 * @returns Epoch milliseconds for the best time, or undefined
 */
const getBestTimeMs = (
  actual?: Date,
  predicted?: Date,
  scheduled?: Date
): number | undefined => {
  if (actual) return actual.getTime();
  if (predicted) return predicted.getTime();
  return scheduled?.getTime();
};
