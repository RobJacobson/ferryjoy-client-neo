import type { Infer } from "convex/values";
import { zodToConvex } from "convex-helpers/server/zod";
import { z } from "zod";
import type { Doc } from "../../_generated/dataModel";
import { epochMillisToDate } from "../../shared/codecs";
import { activeVesselTripZodSchema } from "../activeVesselTrips/schemas";

// Special value for the first incomplete trip for each vessel
// Equals 2020-01-01 00:00:00 UTC
const FIRST_TRIP_START_MS = 1577836800000;

const MILLISECONDS_PER_MINUTE = 1000 * 60;
const ROUNDING_PRECISION = 10;

/**
 * Zod schema for completed vessel trip (domain representation with Date objects)
 * Extends activeVesselTripSchema and adds completion-specific fields
 * This is the single source of truth - no field spreading needed!
 * Exported for use in domain layer conversion functions
 */
export const completedVesselTripZodSchema = activeVesselTripZodSchema.extend({
  // Extended fields
  Key: z.string(),
  TripEnd: epochMillisToDate, // Date in domain, number in Convex
  // Override some fields from base schema (making LeftDockActual required)
  LeftDockActual: epochMillisToDate, // Required in completed trips, Date in domain, number in Convex
  AtDockDuration: z.number(),
  AtSeaDuration: z.number(),
  TotalDuration: z.number(),
});

/**
 * Convex validator for completed vessel trips (converted from Zod schema)
 * This is used in defineTable and function argument validation
 * Exported as completedVesselTripSchema for backward compatibility
 */
export const completedVesselTripSchema = zodToConvex(
  completedVesselTripZodSchema
);

/**
 * Type for completed vessel trip in domain layer (with Date objects)
 * Inferred from the Zod schema
 */
export type CompletedVesselTrip = z.infer<typeof completedVesselTripZodSchema>;

/**
 * Type for completed vessel trip in Convex storage (with numbers)
 * Inferred from the Convex validator - single source of truth!
 */
export type ConvexCompletedVesselTrip = Infer<typeof completedVesselTripSchema>;

/*
 * Transforms an active vessel trip and metrics into a completed vessel trip object
 * Returns null if trip cannot be completed (e.g., placeholder first trip)
 */
export const toConvexCompletedVesselTrip = (
  activeTrip: Doc<"activeVesselTrips">,
  endTime: number
): ConvexCompletedVesselTrip | null => {
  // activeTrip fields are numbers at runtime (Convex stores numbers)
  // TypeScript may infer Date due to stale generated types, so we assert as numbers
  const tripStart = activeTrip.TripStart as unknown as number;
  const leftDockActual = activeTrip.LeftDockActual as unknown as
    | number
    | undefined;
  const scheduledDeparture = activeTrip.ScheduledDeparture as unknown as
    | number
    | undefined;
  const timeStamp = activeTrip.TimeStamp as unknown as number;

  if (tripStart === FIRST_TRIP_START_MS || !leftDockActual) {
    return null;
  }

  // TypeScript can't properly infer ConvexCompletedVesselTrip from Infer<typeof validator>
  // when the validator comes from a Zod schema with codecs, so we use a type assertion
  // The function logic is correct - all values are numbers (Convex format)
  return {
    VesselID: activeTrip.VesselID,
    VesselName: activeTrip.VesselName,
    VesselAbbrev: activeTrip.VesselAbbrev,
    DepartingTerminalID: activeTrip.DepartingTerminalID,
    DepartingTerminalName: activeTrip.DepartingTerminalName,
    DepartingTerminalAbbrev: activeTrip.DepartingTerminalAbbrev,
    ArrivingTerminalID: activeTrip.ArrivingTerminalID,
    ArrivingTerminalName: activeTrip.ArrivingTerminalName,
    ArrivingTerminalAbbrev: activeTrip.ArrivingTerminalAbbrev,
    ScheduledDeparture: scheduledDeparture,
    LeftDock: activeTrip.LeftDock,
    LeftDockActual: leftDockActual,
    InService: activeTrip.InService,
    AtDock: true,
    OpRouteAbbrev: activeTrip.OpRouteAbbrev,
    VesselPositionNum: activeTrip.VesselPositionNum,
    TimeStamp: timeStamp,
    TripStart: tripStart,
    Key: generateTripKey(activeTrip),
    TripEnd: endTime,
    LeftDockDelay: scheduledDeparture
      ? calculateDuration(scheduledDeparture, leftDockActual)
      : undefined,
    AtDockDuration: calculateDuration(tripStart, leftDockActual),
    AtSeaDuration: calculateDuration(leftDockActual, endTime),
    TotalDuration: calculateDuration(tripStart, endTime),
  } as unknown as ConvexCompletedVesselTrip;
};

/**
 * Generates a unique key for a trip based on vessel abbreviation and timestamp
 * Format: "vesselabrv_YYYY-MM-DD_HH:mm" (e.g., "KEN_2025-08-19_17:30")
 */
const generateTripKey = (trip: Doc<"activeVesselTrips">): string => {
  // Assert as numbers since Convex stores numbers, not Dates
  const scheduledDeparture = trip.ScheduledDeparture as unknown as
    | number
    | undefined;
  const timeStamp = trip.TimeStamp as unknown as number;
  const timestamp = scheduledDeparture ?? timeStamp;
  const date = new Date(timestamp);
  return `${trip.VesselAbbrev}_${date.toISOString().slice(0, 16).replace("T", "_")}`;
};

/**
 * Calculates duration between two timestamps in minutes
 * Rounds to the nearest 0.1 minutes
 */
const calculateDuration = (start: number, end: number): number => {
  const durationMinutes = (end - start) / MILLISECONDS_PER_MINUTE;
  return Math.round(durationMinutes * ROUNDING_PRECISION) / ROUNDING_PRECISION;
};

/**
 * Convert Convex completed vessel trip (numbers) to domain completed vessel trip (Dates)
 * Uses Zod schema's decode to automatically convert numbers to Dates
 */
export const toDomainCompletedVesselTrip = (trip: ConvexCompletedVesselTrip) =>
  completedVesselTripZodSchema.decode(trip);
