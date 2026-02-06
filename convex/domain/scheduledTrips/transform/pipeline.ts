import type { ConvexScheduledTrip } from "../../../functions/scheduledTrips/schemas";
import { classifyTripsByType } from "./classification";
import { calculateTripEstimates } from "./estimates";

/**
 * The core transformation pipeline for scheduled trips.
 * Takes raw trips and applies classification and estimation logic.
 *
 * @param trips - Array of raw scheduled trips
 * @returns Array of classified trips with estimates and connections
 */
export const runTransformationPipeline = (
  trips: ConvexScheduledTrip[]
): ConvexScheduledTrip[] => {
  // 1. Classify trips as direct or indirect
  const classified = classifyTripsByType(trips);

  // 2. Calculate arrival estimates and link keys
  const enhanced = calculateTripEstimates(classified);

  return enhanced;
};
