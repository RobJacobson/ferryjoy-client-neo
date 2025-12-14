import { distance } from "@turf/turf";
import type { VesselLocation as DottieVesselLocation } from "ws-dottie/wsf-vessels/core";
import { fetchVesselLocations } from "ws-dottie/wsf-vessels/core";
import { getTerminalLocationById } from "../../../src/data/terminalLocations";
import { api } from "../../_generated/api";
import { type ActionCtx, internalAction } from "../../_generated/server";
import { convertConvexVesselLocation } from "../../shared/convertVesselLocations";
import {
  type ConvexVesselLocation,
  toConvexVesselLocation,
} from "../vesselLocation/schemas";
import { type ConvexVesselTrip, toConvexVesselTrip } from "./schemas";

/**
 * Updates active vessel trips based on current vessel locations
 * This function manages the lifecycle of vessel trips by:
 * 1. Fetching existing active trips and current vessel locations
 * 2. Updating or inserting current active trips
 * 3. Identifying trips that have completed and moving them to the completed trips table
 */
export const updateVesselTrips = internalAction({
  args: {},
  handler: async (ctx) => {
    // 1. Get the current active trips
    const existingTripsList = (
      await ctx.runQuery(api.functions.vesselTrips.queries.getActiveTrips)
    ).map(({ _id, _creationTime, ...rest }) => rest as ConvexVesselTrip);

    // 2. Create a dictionary of existing trips by VesselID
    const existingTripsDict = Object.fromEntries(
      existingTripsList.map((trip) => [trip.VesselID, trip])
    ) as Record<number, ConvexVesselTrip>;

    // 3. Get a list of current locations
    const vesselLocations = (
      (await fetchVesselLocations()) as unknown as DottieVesselLocation[]
    )
      .map(toConvexVesselLocation)
      .map(convertConvexVesselLocation);

    // 4. Map those current locations to current trips and save to the database
    await saveCurrentTrips(ctx, vesselLocations, existingTripsDict);

    // 5. Get a list of completed trips and save to the database
    await saveCompletedTrips(ctx, vesselLocations, existingTripsDict);
  },
});

/**
 * Maps current vessel locations to trips and saves them to the database
 *
 * @param ctx - The ActionCtx context for database operations
 * @param vesselLocations - Array of current vessel location data
 * @param existingTripsDict - Dictionary of existing trips by VesselID
 */
const saveCurrentTrips = async (
  ctx: ActionCtx,
  vesselLocations: ConvexVesselLocation[],
  existingTripsDict: Record<number, ConvexVesselTrip>
): Promise<void> => {
  const currentTripsList = vesselLocations.map((vl) =>
    toCurrentTrip(vl, existingTripsDict[vl.VesselID])
  );
  await ctx.runMutation(
    api.functions.vesselTrips.mutations.bulkUpsertActiveTrips,
    {
      trips: currentTripsList,
    }
  );
};

/**
 * Converts vessel location data to a trip record, handling both new and existing trips
 * Determines the appropriate trip start time based on whether the vessel has changed terminals
 *
 * @param currLocation - Current vessel location data
 * @param existingTrip - Existing trip data for the vessel (may be undefined)
 * @returns A trip record with calculated duration metrics
 */
const toCurrentTrip = (
  currLocation: ConvexVesselLocation,
  existingTrip?: ConvexVesselTrip
): ConvexVesselTrip => {
  // Determine the trip start time:
  // - If no existing trip, undefined (will be set by toConvexVesselTrip)
  // - If same departing terminal, use existing trip start time
  // - If different terminal, start a new trip with current timestamp
  const tripStart = !existingTrip
    ? undefined
    : existingTrip.DepartingTerminalID === currLocation.DepartingTerminalID
      ? existingTrip.TripStart
      : currLocation.TimeStamp;

  // Determine the left dock time:
  // - If new trip, undefined
  // - If current location has a left dock time, use it
  // - If existing trip has a left dock time, use it
  // - Else, if not at dock use the current timestamp
  const leftDock = isNewTrip(currLocation, existingTrip)
    ? undefined
    : (currLocation.LeftDock ??
      existingTrip?.LeftDock ??
      (!currLocation.AtDock ? currLocation.TimeStamp : undefined));

  // Create the trip record with calculated durations
  return toConvexVesselTrip(currLocation, {
    TripStart: tripStart,
    LeftDock: leftDock,
    AtDockDuration: calculateDuration(tripStart, currLocation.LeftDock),
    AtSeaDuration: calculateDuration(
      currLocation.LeftDock,
      currLocation.TimeStamp
    ),
    TotalDuration: calculateDuration(tripStart, currLocation.TimeStamp),
    Distance:
      currLocation.LeftDock &&
      distanceToTerminal(currLocation, currLocation.ArrivingTerminalID),
    Delay: calculateDuration(
      currLocation.ScheduledDeparture,
      currLocation.LeftDock
    ),
  });
};

/**
 * Identifies completed trips from vessel locations and saves them to the database
 *
 * @param ctx - The ActionCtx context for database operations
 * @param vesselLocations - Array of current vessel location data
 * @param existingTripsDict - Dictionary of existing trips by VesselID
 */
const saveCompletedTrips = async (
  ctx: ActionCtx,
  vesselLocations: ConvexVesselLocation[],
  existingTripsDict: Record<number, ConvexVesselTrip>
): Promise<void> => {
  const completedTripsList = vesselLocations
    .filter((cvl) => isNewTrip(cvl, existingTripsDict[cvl.VesselID]))
    .map((cvl) => mergeCompletedTrip(cvl, existingTripsDict[cvl.VesselID]));
  if (completedTripsList.length === 0) {
    return;
  }
  await ctx.runMutation(
    api.functions.vesselTrips.mutations.bulkInsertCompletedTrips,
    {
      trips: completedTripsList,
    }
  );
};

/**
 * Determines if a vessel's trip has completed by checking if the departing terminal has changed
 *
 * @param currentLocation - Current vessel location data
 * @param existingTrip - Existing trip data for the vessel (may be undefined)
 * @returns True if the trip has completed, false otherwise
 */
const isNewTrip = (
  currentLocation: ConvexVesselLocation,
  existingTrip?: ConvexVesselTrip
): boolean =>
  !!existingTrip &&
  existingTrip.DepartingTerminalID !== currentLocation.DepartingTerminalID;

/**
 * Merges current vessel location data with existing trip data to create a completed trip record
 * Updates the final location, timestamp, and calculates duration metrics
 *
 * @param currLocation - Current vessel location data
 * @param existingTrip - Existing trip data for the vessel
 * @returns A complete trip record with end time and duration information
 */
const mergeCompletedTrip = (
  currLocation: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip
): ConvexVesselTrip => {
  return {
    ...existingTrip,
    // Update with current location data
    Latitude: currLocation.Latitude,
    Longitude: currLocation.Longitude,
    Speed: currLocation.Speed,
    Heading: currLocation.Heading,
    TimeStamp: currLocation.TimeStamp,
    // Mark the trip as completed with the current timestamp
    TripEnd: currLocation.TimeStamp,
    // Calculate duration metrics
    AtSeaDuration: calculateDuration(
      existingTrip.LeftDock,
      currLocation.TimeStamp
    ),
    TotalDuration: calculateDuration(
      existingTrip.TripStart,
      currLocation.TimeStamp
    ),
    Distance: distanceToTerminal(currLocation, existingTrip.ArrivingTerminalID),
    Delay: calculateDuration(
      existingTrip.ScheduledDeparture,
      existingTrip.LeftDock
    ),
  };
};

/**
 * Calculates the duration between two timestamps in minutes
 *
 * @param startMs - Start timestamp in milliseconds (may be undefined)
 * @param endMs - End timestamp in milliseconds (may be undefined)
 * @returns Duration in minutes rounded to 1 decimal place, or undefined if inputs are invalid
 */
const calculateDuration = (
  startMs: number | undefined,
  endMs: number | undefined
): number | undefined => {
  // Return undefined if either timestamp is missing
  if (!startMs || !endMs) {
    return undefined;
  }

  const MILLISECONDS_PER_MINUTE = 1000 * 60;
  const durationMinutes = (endMs - startMs) / MILLISECONDS_PER_MINUTE;
  return roundToPrecision(durationMinutes, 10);
};

/**
 * Rounds a number to a specified precision
 *
 * @param value - The number to round
 * @param precision - The precision factor (e.g., 10 for 1 decimal place)
 * @returns The rounded number
 */
const roundToPrecision = (value: number, precision: number): number =>
  Math.round(value * precision) / precision;

/**
 * Calculates the distance from a vessel's current location to a destination terminal in miles
 *
 * @param vesselLocation - The current location of the vessel
 * @param terminalId - The ID of the destination terminal
 * @returns Distance in miles rounded to 1 decimal place, or undefined if terminal not found
 */
const distanceToTerminal = (
  vesselLocation: ConvexVesselLocation,
  terminalId: number | undefined
): number | undefined => {
  if (!terminalId) {
    return undefined;
  }
  const terminal = getTerminalLocationById(terminalId);
  if (!terminal) {
    return undefined;
  }
  return calculateDistance(vesselLocation, terminal);
};

/**
 * Calculates the distance between two points in miles
 *
 * @param p1 - The first point
 * @param p2 - The second point
 * @returns Distance in miles rounded to 1 decimal place, or undefined if either point is undefined
 */
const calculateDistance = (p1: Point, p2: Point): number | undefined => {
  const p1Point = [p1.Longitude, p1.Latitude];
  const p2Point = [p2.Longitude, p2.Latitude];

  // Calculate distance using TurfJS (returns distance in default units - kilometers)
  const distanceInMiles = distance(p1Point, p2Point, { units: "miles" });

  // Round to 1 decimal place
  return roundToPrecision(distanceInMiles, 10);
};

type Point = {
  Longitude: number;
  Latitude: number;
};
