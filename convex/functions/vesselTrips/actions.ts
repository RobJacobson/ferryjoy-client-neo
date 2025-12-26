import { api } from "_generated/api";
import { type ActionCtx, internalAction } from "_generated/server";
import {
  type ConvexVesselLocation,
  toConvexVesselLocation,
} from "functions/vesselLocation/schemas";
import {
  type ConvexVesselTrip,
  toConvexVesselTrip,
} from "functions/vesselTrips/schemas";
import { convertConvexVesselLocation } from "shared/convertVesselLocations";
import {
  calculateAtDockDuration,
  calculateAtSeaDuration,
  calculateTotalDuration,
} from "shared/durationUtils";
import type { VesselLocation as DottieVesselLocation } from "ws-dottie/wsf-vessels/core";
import { fetchVesselLocations } from "ws-dottie/wsf-vessels/core";

/**
 * Updates active vessel trips based on current vessel locations.
 *
 * This action synchronizes the active vessel trips with the latest vessel location data
 * from the WSF API. It handles two main scenarios:
 *
 * 1. **New trip detection**: When no existing trip exists (first time seeing a vessel) or when
 *    the departing terminal changes, the existing trip (if any) is completed and saved to the
 *    completed trips collection, and a new active trip is created.
 *
 * 2. **Trip updates**: When an existing trip needs data updates due to changes in:
 *    - `AtDock` status (e.g., vessel leaves the dock)
 *    - `Eta` (estimated arrival time)
 *    - `ArrivingTerminalAbbrev` (destination terminal)
 *    - `LeftDock` (actual departure time)
 *
 * @returns A Promise that resolves when all vessel trips have been processed.
 */
export const updateVesselTrips = internalAction({
  args: {},
  handler: async (ctx) => {
    // 1. Get the current active trips
    const existingTripsList = (
      await ctx.runQuery(api.functions.vesselTrips.queries.getActiveTrips)
    ).map(({ _id, _creationTime, ...rest }) => rest as ConvexVesselTrip);

    // 2. Create a dictionary of existing trips by VesselAbbrev
    const existingTripsDict = Object.fromEntries(
      existingTripsList.map((trip) => [trip.VesselAbbrev, trip])
    ) as Record<string, ConvexVesselTrip>;

    // 3. Get a list of current locations
    const vesselLocations = (
      (await fetchVesselLocations()) as unknown as DottieVesselLocation[]
    )
      .map(toConvexVesselLocation)
      .map(convertConvexVesselLocation);

    // 4. Process each vessel location
    for (const currLocation of vesselLocations) {
      const existingTrip = existingTripsDict[currLocation.VesselAbbrev];

      // Case (a): New trip - either no existing trip or departing terminal changed
      if (await checkAndHandleNewTrip(ctx, existingTrip, currLocation)) {
        continue;
      }
      // Case (b): Update trip - existing trip needs data updates
      if (existingTrip) {
        await checkAndHandleTripUpdate(ctx, currLocation, existingTrip);
      }
    }
  },
});

/**
 * Checks if a new trip is needed and handles the transition.
 *
 * A new trip is detected when either:
 * - No existing trip exists (first time seeing this vessel)
 * - The departing terminal has changed (indicating a new route has started)
 *
 * When a new trip is needed:
 * - If an existing trip exists, it is completed with a `TripEnd` timestamp and saved
 *   to the `completedVesselTrips` collection
 * - A new active trip is created and inserted into the `activeVesselTrips` collection
 *
 * @param ctx - The Convex action context for running mutations
 * @param existingTrip - The existing active trip for this vessel, or undefined if none exists
 * @param currLocation - The current vessel location data from WSF API
 * @returns `true` if a new trip was handled, `false` if no new trip action was needed
 */
const checkAndHandleNewTrip = async (
  ctx: ActionCtx,
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation
) => {
  if (
    existingTrip &&
    existingTrip.DepartingTerminalAbbrev ===
      currLocation.DepartingTerminalAbbrev
  ) {
    return false;
  }

  if (existingTrip) {
    // Complete existing trip and start new one
    // Calculate AtSeaDuration and TotalDuration when completing the trip
    const atSeaDuration = calculateAtSeaDuration(
      existingTrip.LeftDock,
      currLocation.TimeStamp
    );
    const totalDuration = calculateTotalDuration(
      existingTrip.TripStart,
      currLocation.TimeStamp
    );

    const completedTrip: ConvexVesselTrip = {
      ...existingTrip,
      TripEnd: currLocation.TimeStamp,
      AtSeaDuration: atSeaDuration,
      TotalDuration: totalDuration,
    };

    const newTrip = toConvexVesselTrip(currLocation, {
      TripStart: currLocation.TimeStamp,
    });

    // Atomic operation: complete existing, start new
    await ctx.runMutation(
      api.functions.vesselTrips.mutations.completeAndStartNewTrip,
      {
        completedTrip,
        newTrip,
      }
    );
  } else {
    const delay = calculateDelay(
      currLocation.ScheduledDeparture,
      currLocation.LeftDock
    );

    const newTrip = toConvexVesselTrip(currLocation, {
      Delay: delay,
    });
    await ctx.runMutation(
      api.functions.vesselTrips.mutations.upsertActiveTrip,
      { trip: newTrip }
    );
  }

  return true;
};

/**
 * Checks if trip data needs updating and applies updates to the active trip.
 *
 * This function compares the current vessel location data with the existing active trip
 * and updates the trip if any of the following fields have changed:
 *
 * - `AtDock`: Indicates whether the vessel is currently docked
 * - `Eta`: Estimated arrival time at the destination terminal
 * - `ArrivingTerminalAbbrev`: The destination terminal abbreviation
 * - `LeftDock`: Actual time when the vessel departed from the dock
 *
 * When updates are needed, the `Delay` field is recalculated based on the scheduled
 * departure time and actual `LeftDock` time. All updated fields are then persisted
 * to the database.
 *
 * If no changes are detected, the function returns early without performing any database
 * operations.
 *
 * @param ctx - The Convex action context for running mutations
 * @param currLocation - The current vessel location data from WSF API
 * @param existingTrip - The existing active trip for this vessel
 */
const checkAndHandleTripUpdate = async (
  ctx: ActionCtx,
  currLocation: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip
) => {
  // Check what changed
  // Recalculate AtDockDuration whenever possible
  const calculatedAtDockDuration =
    currLocation.LeftDock && existingTrip.TripStart
      ? calculateAtDockDuration(existingTrip.TripStart, currLocation.LeftDock)
      : undefined;

  // Recalculate Delay whenever possible
  const calculatedDelay = calculateDelay(
    currLocation.ScheduledDeparture,
    currLocation.LeftDock
  );

  const atDockChanged = existingTrip.AtDock !== currLocation.AtDock;
  const etaChanged = existingTrip.Eta !== currLocation.Eta;
  const arrivingTerminalChanged =
    existingTrip.ArrivingTerminalAbbrev !== currLocation.ArrivingTerminalAbbrev;
  const leftDockChanged = existingTrip.LeftDock !== currLocation.LeftDock;
  const atDockDurationChanged =
    calculatedAtDockDuration !== existingTrip.AtDockDuration;
  const delayChanged = calculatedDelay !== existingTrip.Delay;

  if (
    !atDockChanged &&
    !etaChanged &&
    !arrivingTerminalChanged &&
    !leftDockChanged &&
    !atDockDurationChanged &&
    !delayChanged
  ) {
    return;
  }

  const updatedTrip: ConvexVesselTrip = {
    ...existingTrip,
    ArrivingTerminalAbbrev: currLocation.ArrivingTerminalAbbrev,
    AtDock: currLocation.AtDock,
    Eta: currLocation.Eta,
    LeftDock: currLocation.LeftDock,
    Delay: calculatedDelay,
    AtDockDuration: calculatedAtDockDuration,
  };

  await ctx.runMutation(api.functions.vesselTrips.mutations.upsertActiveTrip, {
    trip: updatedTrip,
  });
};

/**
 * Calculates delay in minutes from scheduled departure to actual departure.
 *
 * This function computes the difference between the actual departure time and the
 * scheduled departure time, returning the delay in minutes. A positive delay indicates
 * the vessel departed late, while a negative value would indicate early departure.
 *
 * @param scheduled - Scheduled departure time in milliseconds since epoch
 * @param actual - Actual departure time in milliseconds since epoch
 * @returns Delay in minutes, or `undefined` if either parameter is invalid or missing
 */
const calculateDelay = (
  scheduled: number | undefined,
  actual: number | undefined
): number | undefined => {
  if (!scheduled || !actual) {
    return undefined;
  }
  return roundToPrecision((actual - scheduled) / (1000 * 60), 10);
};

/**
 * Rounds a number to a specified precision.
 *
 * This utility function provides controlled rounding by multiplying the value by the
 * precision factor, rounding to the nearest integer, and then dividing back.
 *
 * @param value - The numeric value to round
 * @param precision - The precision factor (e.g., 10 for 1 decimal place, 100 for 2 decimal places)
 * @returns The rounded number
 */
const roundToPrecision = (value: number, precision: number): number =>
  Math.round(value * precision) / precision;
