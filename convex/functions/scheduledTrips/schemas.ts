import type { Infer } from "convex/values";
import { v } from "convex/values";
import { terminalLocations } from "src/data/terminalLocations";
import { getVesselAbbreviation } from "src/domain/vesselAbbreviations";
import { epochMsToDate } from "../../shared/convertDates";

// Re-export for convenience
export { getVesselAbbreviation };

/**
 * Get terminal abbreviation by terminal name
 *
 * @param terminalName - The full name of the terminal
 * @returns The terminal abbreviation or empty string if not found
 */
export const getTerminalAbbreviation = (terminalName: string): string =>
  Object.values(terminalLocations).find((t) => t.TerminalName === terminalName)
    ?.TerminalAbbrev || "";

/**
 * Convex validator for scheduled trips
 */
export const scheduledTripSchema = v.object({
  VesselAbbrev: v.string(),
  DepartingTerminalAbbrev: v.string(),
  ArrivingTerminalAbbrev: v.string(),
  DepartingTime: v.number(),
  ArrivingTime: v.optional(v.number()),
  SailingNotes: v.string(),
  Annotations: v.array(v.string()),
  RouteID: v.number(),
  RouteAbbrev: v.string(),
  Key: v.string(),
  SailingDay: v.string(), // WSF operational day in YYYY-MM-DD format
  TripType: v.union(v.literal("direct"), v.literal("indirect")),
  PrevKey: v.optional(v.string()),
  NextKey: v.optional(v.string()),
  NextDepartingTime: v.optional(v.number()),
  EstArriveNext: v.optional(v.number()),
  EstArriveCurr: v.optional(v.number()),
});

/**
 * Type for scheduled trip in Convex storage (with numbers)
 * Inferred from the Convex validator
 */
export type ConvexScheduledTrip = Infer<typeof scheduledTripSchema>;

/**
 * Convert Convex scheduled trip (numbers) to domain scheduled trip (Dates).
 * Manual conversion from epoch milliseconds to Date objects.
 *
 * @param trip - Convex scheduled trip with numeric timestamps
 * @returns Domain scheduled trip with Date objects
 */
export const toDomainScheduledTrip = (trip: ConvexScheduledTrip) => ({
  ...trip,
  DepartingTime: epochMsToDate(trip.DepartingTime),
  ArrivingTime: trip.ArrivingTime
    ? epochMsToDate(trip.ArrivingTime)
    : undefined,
  EstArriveNext: trip.EstArriveNext
    ? epochMsToDate(trip.EstArriveNext)
    : undefined,
  EstArriveCurr: trip.EstArriveCurr
    ? epochMsToDate(trip.EstArriveCurr)
    : undefined,
  NextDepartingTime: trip.NextDepartingTime
    ? epochMsToDate(trip.NextDepartingTime)
    : undefined,
});

/**
 * Type for scheduled trip in domain layer (with Date objects)
 * Inferred from the return type of our conversion function
 */
export type ScheduledTrip = ReturnType<typeof toDomainScheduledTrip>;
