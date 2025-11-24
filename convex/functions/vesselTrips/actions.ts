import { distance } from "@turf/turf";
import { getTerminalData } from "../../../src/data/terminalLocations";
import { api } from "../../_generated/api";
import type { ActionCtx } from "../../_generated/server";
import type { ConvexVesselLocation } from "../vesselLocation/schemas";
import { type ConvexVesselTrip, toConvexVesselTrip } from "./schemas";

/**
 * Updates active vessel trips based on current vessel locations
 * This function manages the lifecycle of vessel trips by:
 * 1. Identifying trips that have completed and moving them to the completed trips table
 * 2. Updating or inserting current active trips
 *
 * @param ctx - The ActionCtx context for database operations
 * @param currentLocations - Array of current vessel location data
 */
export const updateActiveVesselTrips = async (
  ctx: ActionCtx,
  currentLocations: ConvexVesselLocation[]
): Promise<void> => {
  // Step 1: Retrieve all existing active trips from the database
  const existingTripsList = (
    await ctx.runQuery(api.functions.vesselTrips.queries.getActiveTrips)
  ).map(({ _id, _creationTime, ...trip }) => trip as ConvexVesselTrip);

  // Convert the array to a dictionary for O(1) lookup by VesselID
  const existingTripsDict = Object.fromEntries(
    existingTripsList.map((trip) => [trip.VesselID, trip])
  );

  // Step 2: Process and save any completed trips to the completedVesselTrips table
  await saveCompletedTrips(ctx, currentLocations, existingTripsDict);

  // Step 3: Update or insert current trips into the activeVesselTrips table
  await updateActiveTrips(ctx, currentLocations, existingTripsDict);
};

/**
 * Identifies completed trips and saves them to the completedVesselTrips table
 * A trip is considered completed when the vessel's departing terminal has changed
 *
 * @param ctx - The ActionCtx context for database operations
 * @param currentLocations - Array of current vessel location data
 * @param existingTripsDict - Dictionary of existing trips indexed by VesselID
 */
const saveCompletedTrips = async (
  ctx: ActionCtx,
  currentLocations: ConvexVesselLocation[],
  existingTripsDict: Record<string, ConvexVesselTrip>
): Promise<void> => {
  // Filter for vessels whose trips have completed and transform the data
  const completedTrips = currentLocations
    .filter((vl) => hasTripCompleted(vl, existingTripsDict[vl.VesselID]))
    .map((vl) => mergeCompletedTrip(vl, existingTripsDict[vl.VesselID]));

  // If no trips have completed, return early
  if (completedTrips.length === 0) {
    return;
  }

  // Insert the completed trips into the completedVesselTrips table
  await ctx.runMutation(
    api.functions.vesselTrips.mutations.bulkInsertCompletedTrips,
    {
      trips: completedTrips,
    }
  );
};

/**
 * Determines if a vessel's trip has completed by checking if the departing terminal has changed
 *
 * @param vl - Current vessel location data
 * @param existingTrip - Existing trip data for the vessel
 * @returns True if the trip has completed, false otherwise
 */
const hasTripCompleted = (
  vl: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip
): boolean =>
  !!existingTrip && existingTrip.DepartingTerminalID !== vl.DepartingTerminalID;

/**
 * Merges current vessel location data with existing trip data to create a completed trip record
 * Updates the final location, timestamp, and calculates duration metrics
 *
 * @param vl - Current vessel location data
 * @param existingTrip - Existing trip data for the vessel
 * @returns A complete trip record with end time and duration information
 */
const mergeCompletedTrip = (
  vl: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip
): ConvexVesselTrip => {
  return {
    ...existingTrip,
    // Update with current location data
    Latitude: vl.Latitude,
    Longitude: vl.Longitude,
    Speed: vl.Speed,
    Heading: vl.Heading,
    TimeStamp: vl.TimeStamp,
    // Mark the trip as completed with the current timestamp
    TripEnd: vl.TimeStamp,
    // Calculate duration metrics
    AtSeaDuration: calculateDuration(existingTrip.LeftDock, vl.TimeStamp),
    TotalDuration: calculateDuration(existingTrip.TripStart, vl.TimeStamp),
    Distance: calculateDistanceToTerminal(vl, existingTrip.ArrivingTerminalID),
    Delay: calculateDuration(
      existingTrip.ScheduledDeparture,
      existingTrip.LeftDock
    ),
  };
};

/**
 * Updates or inserts current active trips into the activeVesselTrips table
 * Processes each vessel location to create or update corresponding trip records
 *
 * @param ctx - The ActionCtx context for database operations
 * @param currentLocations - Array of current vessel location data
 * @param existingTripsDict - Dictionary of existing trips indexed by VesselID
 */
const updateActiveTrips = async (
  ctx: ActionCtx,
  currentLocations: ConvexVesselLocation[],
  existingTripsDict: Record<string, ConvexVesselTrip>
): Promise<void> => {
  // Transform each vessel location into a trip record
  const activeTrips = currentLocations.map((vl) =>
    toCurrentTrip(vl, existingTripsDict[vl.VesselID])
  );

  // If no active trips to process, return early
  if (activeTrips.length === 0) {
    return;
  }

  // Insert or update the active trips in the database
  await ctx.runMutation(
    api.functions.vesselTrips.mutations.bulkUpsertActiveTrips,
    {
      trips: activeTrips,
    }
  );
};

/**
 * Converts vessel location data to a trip record, handling both new and existing trips
 * Determines the appropriate trip start time based on whether the vessel has changed terminals
 *
 * @param vl - Current vessel location data
 * @param existingTrip - Existing trip data for the vessel (may be undefined)
 * @returns A trip record with calculated duration metrics
 */
const toCurrentTrip = (
  vl: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip
): ConvexVesselTrip => {
  // Determine the trip start time:
  // - If no existing trip, undefined (will be set by toConvexVesselTrip)
  // - If same departing terminal, use existing trip start time
  // - If different terminal, start a new trip with current timestamp
  const tripStart = !existingTrip
    ? undefined
    : existingTrip.DepartingTerminalID === vl.DepartingTerminalID
      ? existingTrip.TripStart
      : vl.TimeStamp;

  // Create the trip record with calculated durations
  return toConvexVesselTrip(vl, {
    TripStart: tripStart,
    AtDockDuration: calculateDuration(tripStart, vl.LeftDock),
    AtSeaDuration: calculateDuration(vl.LeftDock, vl.TimeStamp),
    TotalDuration: calculateDuration(tripStart, vl.TimeStamp),
    Distance:
      vl.LeftDock && calculateDistanceToTerminal(vl, vl.ArrivingTerminalID),
    Delay: calculateDuration(vl.ScheduledDeparture, vl.LeftDock),
  });
};

/**
 * Calculates the duration between two timestamps in minutes
 *
 * @param startMs - Start timestamp in milliseconds (may be undefined)
 * @param endMs - End timestamp in milliseconds (may be undefined)
 * @returns Duration in minutes rounded to 10 decimal places, or undefined if inputs are invalid
 */
const calculateDuration = (
  startMs: number | undefined,
  endMs: number | undefined
): number | undefined => {
  // Return undefined if either timestamp is missing
  if (!startMs || !endMs) {
    return undefined;
  }

  const MILISECONDS_PER_MINUTE = 1000 * 60;
  const durationMinutes = (endMs - startMs) / MILISECONDS_PER_MINUTE;
  return rountdToPrecision(durationMinutes, 10);
};

/**
 * Rounds a number to a specified precision
 *
 * @param value - The number to round
 * @param precision - The precision factor (e.g., 10 for 1 decimal place)
 * @returns The rounded number
 */
const rountdToPrecision = (value: number, precision: number): number =>
  Math.round(value * precision) / precision;

/**
 * Calculates the distance from a vessel's current location to a destination terminal in miles
 * Uses TurfJS to compute the great-circle distance between two points
 *
 * @param vesselLocation - The current location of the vessel
 * @param arrivingTerminalId - The ID of the destination terminal
 * @returns Distance in miles, or null if terminal not found
 */
export const calculateDistanceToTerminal = (
  vesselLocation: ConvexVesselLocation,
  arrivingTerminalId?: number
): number | undefined => {
  // Get destination terminal coordinates
  const destinationTerminal =
    arrivingTerminalId && getTerminalData(arrivingTerminalId);

  // Return undefined if terminal not found
  if (!destinationTerminal) {
    return undefined;
  }

  // Create points for TurfJS distance calculation
  const vesselPoint = [vesselLocation.Longitude, vesselLocation.Latitude];
  const terminalPoint = [
    destinationTerminal.Longitude,
    destinationTerminal.Latitude,
  ];

  // Calculate distance using TurfJS (returns distance in default units - kilometers)
  const distanceInKm = distance(vesselPoint, terminalPoint, {
    units: "kilometers",
  });

  // Convert kilometers to miles (1 km = 0.621371 miles)
  const distanceInMiles = distanceInKm * 0.621371;

  // Round to 2 decimal places
  return rountdToPrecision(distanceInMiles, 10);
};
