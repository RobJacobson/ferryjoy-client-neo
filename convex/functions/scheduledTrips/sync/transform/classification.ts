/**
 * Logic for distinguishing Direct vs. Indirect trips.
 * A "Direct" trip is the immediate next stop for a vessel.
 *
 * @module
 */

import type { ConvexScheduledTrip } from "../../schemas";
import { classifyDirectSegments } from "./directSegments";

/**
 * Classifies trips as direct or indirect using a chronological physical departure scan.
 * Multi-destination departures are resolved by looking ahead at the vessel's next stop.
 *
 * @param trips - Array of scheduled trip records to classify
 * @returns Array of all trips with TripType field set to "direct" or "indirect"
 */
export const classifyTripsByType = (
  trips: ConvexScheduledTrip[]
): ConvexScheduledTrip[] => classifyDirectSegments(trips);
