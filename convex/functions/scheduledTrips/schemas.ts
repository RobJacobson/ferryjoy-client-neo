import type { Infer } from "convex/values";
import { v } from "convex/values";
import { terminalLocations } from "src/data/terminalLocations";
import { getVesselAbbreviation } from "src/domain/vesselAbbreviations";
import { getPacificTime } from "../../domain/ml/training/shared/time";
import { epochMsToDate } from "../../shared/convertDates";

// Re-export for convenience
export { getVesselAbbreviation };

/**
 * Calculate the sailing day for a departure time using WSF's operational day rules
 * Sailing day spans from 3:00AM Pacific to 2:59AM Pacific the next day
 * @param departureTime - Departure time as Date object
 * @returns Sailing day in YYYY-MM-DD format
 */
export const calculateSailingDay = (departureTime: Date): string => {
  // Convert to Pacific time using existing utility
  const pacificTime = getPacificTime(departureTime);

  // Create a new date object to avoid mutating the input
  const adjustedDate = new Date(pacificTime);

  // If departure is before 3:00 AM Pacific, it belongs to the previous sailing day
  if (pacificTime.getHours() < 3) {
    adjustedDate.setDate(adjustedDate.getDate() - 1);
  }

  // Format as YYYY-MM-DD string
  return adjustedDate.toISOString().split("T")[0];
};

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
  SailingDay: v.string(), // WSF operational day in YYYY-MM-DD format
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
  ArrivingTime: trip.ArrivingTime
    ? epochMsToDate(trip.ArrivingTime)
    : undefined,
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
