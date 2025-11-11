import { type Infer, v } from "convex/values";
import type { Doc } from "../../_generated/dataModel";

import { activeVesselTripSchema } from "../activeVesselTrips/schemas";

// Special value for the first incomplete trip for each vessel
// Equals 2020-01-01 00:00:00 UTC
const FIRST_TRIP_START_MS = 1577836800000;

const MILLISECONDS_PER_MINUTE = 1000 * 60;
const ROUNDING_PRECISION = 10;

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

/*
 * Transforms an active vessel trip and metrics into a completed vessel trip object
 * Returns null if trip cannot be completed (e.g., placeholder first trip)
 */
export const toConvexCompletedVesselTrip = (
  activeTrip: Doc<"activeVesselTrips">,
  endTime: number
): ConvexCompletedVesselTrip | null => {
  if (
    activeTrip.TripStart === FIRST_TRIP_START_MS ||
    !activeTrip.LeftDockActual
  ) {
    return null;
  }

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
    ScheduledDeparture: activeTrip.ScheduledDeparture,
    LeftDock: activeTrip.LeftDock,
    LeftDockActual: activeTrip.LeftDockActual,
    InService: activeTrip.InService,
    AtDock: true,
    OpRouteAbbrev: activeTrip.OpRouteAbbrev,
    VesselPositionNum: activeTrip.VesselPositionNum,
    TimeStamp: activeTrip.TimeStamp,
    TripStart: activeTrip.TripStart,
    Key: generateTripKey(activeTrip),
    TripEnd: endTime,
    LeftDockDelay: activeTrip.ScheduledDeparture
      ? calculateDuration(
          activeTrip.ScheduledDeparture,
          activeTrip.LeftDockActual
        )
      : undefined,
    AtDockDuration: calculateDuration(
      activeTrip.TripStart,
      activeTrip.LeftDockActual
    ),
    AtSeaDuration: calculateDuration(activeTrip.LeftDockActual, endTime),
    TotalDuration: calculateDuration(activeTrip.TripStart, endTime),
  };
};

/**
 * Generates a unique key for a trip based on vessel abbreviation and timestamp
 * Format: "vesselabrv_YYYY-MM-DD_HH:mm" (e.g., "KEN_2025-08-19_17:30")
 */
const generateTripKey = (trip: Doc<"activeVesselTrips">): string => {
  const timestamp = trip.ScheduledDeparture ?? trip.TimeStamp;
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
