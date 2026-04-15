/**
 * Prefetch-time schedule policies applied to raw mapped rows before the main
 * transform pipeline (`runScheduleTransformPipeline`).
 */

import type { ConvexScheduledTrip } from "../../functions/scheduledTrips/schemas";

/**
 * Applies rules that should run immediately after a row is mapped from WSF
 * segments and before classification and estimates.
 *
 * Today: Route 9 (Anacortes / San Juan Islands) uses WSF-provided arrival
 * times as the official scheduled arrival at the segment’s arriving terminal
 * (`SchedArriveCurr`) when present. Other routes leave those fields for the
 * estimate/linking pass.
 *
 * @param trip - Initial storage-shaped row with `TripType` defaulted to direct
 * @returns Row with prefetch-only fields applied (immutable)
 */
export const applyPrefetchSchedulePolicies = (
  trip: ConvexScheduledTrip
): ConvexScheduledTrip => {
  if (trip.RouteID === 9 && trip.ArrivingTime !== undefined) {
    return { ...trip, SchedArriveCurr: trip.ArrivingTime };
  }
  return trip;
};
