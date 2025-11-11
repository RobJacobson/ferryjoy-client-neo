import type { Doc } from "@convex/_generated/dataModel";
import {
  type CompletedVesselTrip,
  type StoredCompletedVesselTrip,
  toCompletedVesselTrip as toDomainCompletedTrip,
  toStoredCompletedVesselTrip,
} from "@domain";
import { type Infer, v } from "convex/values";

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

/**
 * Type for Convex completed vessel trip
 */
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
  toDomainCompletedTrip(cvt as StoredCompletedVesselTrip);

/**
 * Converts raw WSF vessel location data to Convex format
 * Date → number, null → undefined
 *
 * @param trip - The domain format completed vessel trip to convert
 * @returns Convex format completed vessel trip
 * @throws Error if conversion fails
 */
export const toConvexCompletedVesselTrip = (
  trip: CompletedVesselTrip
): ConvexCompletedVesselTrip =>
  toStoredCompletedVesselTrip(trip) as ConvexCompletedVesselTrip;
