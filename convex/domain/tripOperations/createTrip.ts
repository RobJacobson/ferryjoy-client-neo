import { api } from "@convex/_generated/api";
import type { ActionCtx } from "@convex/_generated/server";

import { getVesselAbbreviation } from "@/data/utils/vesselAbbreviations";

import type { ConvexActiveVesselTrip } from "../../functions/activeVesselTrips/schemas";
import type { ConvexVesselLocation } from "../../functions/vesselLocation/schemas";

/**
 * Creates and inserts a new active vessel trip into the database.
 * This function is called when a vessel starts a new journey or when
 * no existing trip is found for a vessel.
 *
 * @param ctx - The Convex action context for running mutations
 * @param currPosition - Current vessel location data from WSF API
 * @param tripStart - The timestamp when the trip started
 */
export const insertNewTrip = async (
  ctx: ActionCtx,
  currPosition: ConvexVesselLocation,
  tripStart: number
) => {
  const newTrip = createActiveTrip(currPosition, tripStart);

  // Ensure uniqueness per VesselID by removing any stale active trip docs first
  await ctx.runMutation(
    api.functions.activeVesselTrips.mutations.deleteByVesselId,
    {
      vesselId: newTrip.VesselID,
    }
  );
  await ctx.runMutation(api.functions.activeVesselTrips.mutations.insert, {
    trip: newTrip,
  });
  console.log(
    `New trip for ${newTrip.VesselAbbrev} (${newTrip.VesselID}): ${JSON.stringify(newTrip)}`
  );
};

/**
 * Converts a VesselLocation to an ActiveVesselTrip for new trip creation.
 * This function handles the business logic of transforming vessel location data
 * into trip data, including setting initial trip state and handling field mappings.
 * It uses the vessel abbreviation lookup table for consistent vessel identification.
 *
 * @param vl - Current vessel location data from WSF API
 * @returns Active vessel trip object ready for database insertion
 */
export const createActiveTrip = (
  vl: ConvexVesselLocation,
  tripStart: number
): ConvexActiveVesselTrip => ({
  VesselID: vl.VesselID,
  VesselName: vl.VesselName,
  VesselAbbrev: getVesselAbbreviation(vl.VesselName),
  DepartingTerminalID: vl.DepartingTerminalID,
  DepartingTerminalName: vl.DepartingTerminalName,
  DepartingTerminalAbbrev: vl.DepartingTerminalAbbrev,
  ArrivingTerminalID: vl.ArrivingTerminalID,
  ArrivingTerminalName: vl.ArrivingTerminalName,
  ArrivingTerminalAbbrev: vl.ArrivingTerminalAbbrev,
  ScheduledDeparture: vl.ScheduledDeparture,
  LeftDock: vl.LeftDock,
  LeftDockActual: undefined,
  LeftDockDelay: undefined,
  Eta: vl.Eta,
  InService: vl.InService,
  AtDock: vl.AtDock,
  OpRouteAbbrev: vl.OpRouteAbbrev,
  VesselPositionNum: vl.VesselPositionNum,
  TimeStamp: vl.TimeStamp,
  TripStart: tripStart,
});
