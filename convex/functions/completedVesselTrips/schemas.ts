import type { Infer } from "convex/values";
import { v } from "convex/values";
import { epochMsToDate } from "../../shared/dateConversion";
import {
  activeVesselTripSchema,
  type ConvexActiveVesselTrip,
  toDomainActiveVesselTrip,
} from "../activeVesselTrips/schemas";

const MILLISECONDS_PER_MINUTE = 1000 * 60;
const ROUNDING_PRECISION = 10;

/**
 * Type for completed vessel trip in Convex storage (with numbers)
 * This is a union type that extends ConvexActiveVesselTrip with additional fields
 */

/**
 * Convex validator for completed vessel trips (numbers)
 * Extends activeVesselTripSchema with additional fields
 * Uses field spreading to include all fields from activeVesselTripSchema
 */
export const completedVesselTripSchema = v.object({
  ...activeVesselTripSchema.fields,
  TripEnd: v.number(),
  AtDockDuration: v.optional(v.number()),
  AtSeaDuration: v.optional(v.number()),
  TotalDuration: v.optional(v.number()),
});

export type ConvexCompletedVesselTrip = Infer<typeof completedVesselTripSchema>;

/**
 * Transforms an active vessel trip and metrics into a completed vessel trip object
 * Returns null if trip cannot be completed (e.g., placeholder first trip)
 */
export const toConvexCompletedVesselTrip = (
  activeTrip: ConvexActiveVesselTrip,
  endTime: number
): ConvexCompletedVesselTrip => ({
  ...activeTrip,
  TripEnd: endTime,
  LeftDockDelay: calculateDuration(
    activeTrip.ScheduledDeparture,
    activeTrip.LeftDockActual
  ),
  AtDockDuration: calculateDuration(
    activeTrip.TripStart,
    activeTrip.LeftDockActual
  ),
  AtSeaDuration: calculateDuration(activeTrip.LeftDockActual, endTime),
  TotalDuration: calculateDuration(activeTrip.TripStart, endTime),
});

/**
 * Convert Convex completed vessel trip (numbers) to domain completed vessel trip (Dates)
 * Manual conversion from epoch milliseconds to Date objects
 */
export const toDomainCompletedVesselTrip = (
  trip: ConvexCompletedVesselTrip
) => ({
  ...toDomainActiveVesselTrip(trip),
  TripEnd: epochMsToDate(trip.TripEnd),
  AtDockDuration: trip.AtDockDuration,
  AtSeaDuration: trip.AtSeaDuration,
  TotalDuration: trip.TotalDuration,
});

/**
 * Type for completed vessel trip in domain layer (with Date objects)
 * Inferred from the return type of our conversion function
 */
export type CompletedVesselTrip = ReturnType<
  typeof toDomainCompletedVesselTrip
>;

/**
 * Calculates duration between two timestamps in minutes
 * Rounds to the nearest 0.1 minutes
 */
const calculateDuration = (
  start: number | undefined,
  end: number | undefined
): number | undefined => {
  if (!start || !end) {
    return undefined;
  }
  const durationMinutes = (end - start) / MILLISECONDS_PER_MINUTE;
  return Math.round(durationMinutes * ROUNDING_PRECISION) / ROUNDING_PRECISION;
};
