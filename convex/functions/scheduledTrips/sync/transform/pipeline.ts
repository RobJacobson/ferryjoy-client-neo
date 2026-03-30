/**
 * ScheduledTrips transformation pipeline.
 *
 * This module coordinates the domain steps that classify raw schedule rows and
 * then enrich them with arrival estimates plus chain-link metadata.
 */

import type { ConvexScheduledTrip } from "../../schemas";
import { classifyDirectSegments } from "./directSegments";
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
  const classified = classifyDirectSegments(trips);
  const enhanced = calculateTripEstimates(classified);

  return enhanced;
};
