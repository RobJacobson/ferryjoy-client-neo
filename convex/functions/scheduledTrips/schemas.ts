import type { Infer } from "convex/values";
import { v } from "convex/values";
import { terminalLocations } from "src/data/terminalLocations";
import { getVesselAbbreviation } from "src/domain/vesselAbbreviations";
import { epochMsToDate } from "../../shared/convertDates";

// Re-export for convenience
export { getVesselAbbreviation };

/**
 * Get terminal abbreviation by terminal name
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
});

/**
 * Type for scheduled trip in Convex storage (with numbers)
 * Inferred from the Convex validator
 */
export type ConvexScheduledTrip = Infer<typeof scheduledTripSchema>;

/**
 * Convert Convex scheduled trip (numbers) to domain scheduled trip (Dates)
 * Manual conversion from epoch milliseconds to Date objects
 */
export const toDomainScheduledTrip = (trip: ConvexScheduledTrip) => ({
  ...trip,
  DepartingTime: epochMsToDate(trip.DepartingTime),
  ArrivingTime: trip.ArrivingTime ? epochMsToDate(trip.ArrivingTime) : undefined,
});

/**
 * Generate composite key for scheduled trip
 * Format: "[Vessel Abbrev]-[Departing Terminal Abbrev]-[Arriving Terminal Abbrev]-[Departing Time]"
 * Example: "TAC-BBI-P52-2025-12-21T00:20:00"
 */
export const generateScheduledTripKey = (
  vesselAbbrev: string,
  departingTerminalAbbrev: string,
  arrivingTerminalAbbrev: string,
  departingTime: Date
): string => {
  const timeStr = departingTime.toISOString().replace(".000Z", "");
  return `${vesselAbbrev}-${departingTerminalAbbrev}-${arrivingTerminalAbbrev}-${timeStr}`;
};

/**
 * Type for scheduled trip in domain layer (with Date objects)
 * Inferred from the return type of our conversion function
 */
export type ScheduledTrip = ReturnType<typeof toDomainScheduledTrip>;
