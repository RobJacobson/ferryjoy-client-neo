import { type Infer, v } from "convex/values";
import {
  type CompletedVesselTrip,
  toConvexCompletedVesselTrip as toConvexCompletedVesselTripFromDomain,
  fromConvexCompletedVesselTrip as toDomainCompletedTrip,
} from "src/domain";
import type { Doc } from "../../_generated/dataModel";

import { activeVesselTripSchema } from "../activeVesselTrips/schemas";
export const completedVesselTripSchema = v.object({
  ...activeVesselTripSchema.fields,
  // Extended fields
  Key: v.string(),
  TripStart: v.number(),
  TripEnd: v.number(),
  LeftDock: v.optional(v.number()),
  LeftDockActual: v.number(),
  LeftDockDelay: v.optional(v.number()),
  AtDockDuration: v.number(),
  AtSeaDuration: v.number(),
  TotalDuration: v.number(),
});

// Export inferred types for use in domain layer
export type ConvexCompletedVesselTrip = Infer<typeof completedVesselTripSchema>;

/**
 * Converts Convex vessel trip to domain format
 * number → Date, undefined → null
 *
 * @param cvt - The Convex document to convert
 * @returns Domain format completed vessel trip
 * @throws Error if conversion fails
 */
export const toCompletedTrip = (
  cvt: Doc<"completedVesselTrips">
): CompletedVesselTrip =>
  toDomainCompletedTrip(cvt as ConvexCompletedVesselTrip);

/**
 * Converts domain format completed vessel trip to Convex format
 * Date → number, null → undefined
 *
 * @param trip - The domain format completed vessel trip to convert
 * @returns Convex format completed vessel trip
 * @throws Error if conversion fails
 */
export const toConvexCompletedVesselTrip = (
  trip: CompletedVesselTrip
): ConvexCompletedVesselTrip => toConvexCompletedVesselTripFromDomain(trip);
