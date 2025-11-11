import { v } from "convex/values";
import { api } from "../../_generated/api";
import type { Doc } from "../../_generated/dataModel";
import type { ActionCtx } from "../../_generated/server";
import { internalAction } from "../../_generated/server";
import type { ConvexCompletedVesselTrip } from "./schemas";

// Special value for the first incomplete trip for each vessel
// Equals 2020-01-01 00:00:00 UTC
const FIRST_TRIP_START_MS = 1577836800000;

const MILLISECONDS_PER_MINUTE = 1000 * 60;
const ROUNDING_PRECISION = 10;

/**
 * Action for adding a completed vessel trip
 * Calculates trip metrics and stores the completed trip
 * Note: The active trip deletion is handled by the calling action (createNewActiveTrip)
 */
export const addCompletedVesselTrip = internalAction({
  args: {
    completedTrip: v.any(), // Doc<"activeVesselTrips"> - using v.any() because Doc types can't be validated
    endTime: v.number(),
  },
  handler: async (ctx, args) => {
    // Calculate trip metrics
    const completedTripData = calculateCompletedTripMetrics(
      args.completedTrip as Doc<"activeVesselTrips">,
      args.endTime
    );

    // Skip if this is not a valid completed trip (e.g., placeholder first trip)
    if (!completedTripData) {
      return;
    }

    // Store in completed trips table
    await ctx.runMutation(api.functions.completedVesselTrips.mutations.insert, {
      trip: completedTripData,
    });

    console.log(
      `Completed trip for ${completedTripData.VesselAbbrev} (${completedTripData.VesselID}): ${JSON.stringify(completedTripData)}`
    );
  },
});

/**
 * Calculates metrics for a completed trip
 * Returns null if the trip cannot be completed (e.g., placeholder first trip)
 */
const calculateCompletedTripMetrics = (
  activeTrip: Doc<"activeVesselTrips">,
  endTime: number
): ConvexCompletedVesselTrip | null => {
  // Skip if this is a placeholder first trip or missing required data
  if (
    activeTrip.TripStart === FIRST_TRIP_START_MS ||
    !activeTrip.LeftDockActual
  ) {
    return null;
  }

  const leftDockActual = activeTrip.LeftDockActual;

  return {
    ...activeTrip,
    AtDock: true,
    LeftDockActual: leftDockActual,
    Key: generateTripKey(activeTrip),
    TripEnd: endTime,
    LeftDockDelay: activeTrip.ScheduledDeparture
      ? calculateDuration(activeTrip.ScheduledDeparture, leftDockActual)
      : undefined,
    AtDockDuration: calculateDuration(activeTrip.TripStart, leftDockActual),
    AtSeaDuration: calculateDuration(leftDockActual, endTime),
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
