import { api } from "@convex/_generated/api";
import type { ActionCtx } from "@convex/_generated/server";

import type { ConvexActiveVesselTrip } from "../../functions/activeVesselTrips/schemas";
import type { ConvexVesselLocation } from "../../functions/vesselLocation/schemas";

/**
 * Updates an existing active vessel trip with new location data.
 * This function compares the current trip with new location data and updates
 * only the fields that have changed, avoiding unnecessary database updates.
 *
 * @param ctx - The Convex action context for running mutations
 * @param currTrip - The existing active trip to be updated
 * @param currLocation - Current vessel location data from WSF API
 */
export const updateCurrentTrip = async (
  ctx: ActionCtx,
  currTrip: ConvexActiveVesselTrip,
  currLocation: ConvexVesselLocation
): Promise<void> => {
  // Ensure the location data is for the same vessel and is newer
  if (
    currLocation.TimeStamp <= currTrip.TimeStamp ||
    currLocation.VesselID !== currTrip.VesselID
  ) {
    return;
  }

  // Get the update trip data
  const updatedTripData = getUpdateTripData(currTrip, currLocation);

  // If we have just left dock, record the current timestamp as LeftDockActual
  if (currTrip.AtDock && !currLocation.AtDock) {
    (updatedTripData as Record<string, unknown>).LeftDockActual =
      currLocation.TimeStamp;
  }

  // Return early if none of the relevant fields have changed
  if (Object.keys(updatedTripData).length === 0) {
    return;
  }

  // Update the trip in the database
  await ctx.runMutation(api.functions.activeVesselTrips.mutations.update, {
    trip: {
      ...currTrip,
      ...updatedTripData,
      TimeStamp: currLocation.TimeStamp,
    },
  });

  // Log the update
  console.log(
    `Update for ${currTrip.VesselAbbrev} (${currTrip.VesselID}): ${JSON.stringify(updatedTripData)}`
  );
};

/**
 * Compares two objects and returns only the fields that have different values.
 * This function is used to create partial update objects for database operations,
 * ensuring only changed fields are updated to minimize database writes.
 *
 * The function compares fields that exist in both ActiveVesselTrip and VesselLocation types,
 * using the commonFields array to ensure type safety and consistency.
 *
 * @param currTrip - The existing active vessel trip from the database
 * @param currLocation - Current vessel location data from WSF API
 * @returns A partial ActiveVesselTrip object containing only the fields that have changed,
 *          or an empty object if no changes are detected
 */
const getUpdateTripData = (
  currTrip: ConvexActiveVesselTrip,
  currLocation: ConvexVesselLocation
): Partial<ConvexActiveVesselTrip> =>
  commonFields.reduce(
    (updates, field) => {
      const locationValue = currLocation[field];
      const tripValue = currTrip[field];

      if (tripValue !== locationValue) {
        // Safe type assertion since we know the field exists in both types
        (updates as Record<string, unknown>)[field] = locationValue;
      }

      return updates;
    },
    {} as Partial<ConvexActiveVesselTrip>
  );

// Fields present in both ActiveVesselTrip and VesselLocation
const commonFields: Array<
  keyof ConvexActiveVesselTrip & keyof ConvexVesselLocation
> = [
  "VesselID", // number
  "VesselName", // string
  "DepartingTerminalID", // number
  "DepartingTerminalName", // string
  "DepartingTerminalAbbrev", // string
  "ArrivingTerminalID", // number | null
  "ArrivingTerminalName", // string | null
  "ArrivingTerminalAbbrev", // string | null
  "InService", // boolean
  "AtDock", // boolean
  "ScheduledDeparture", // number | undefined
  "LeftDock", // number | undefined
  "Eta", // number | undefined
  "OpRouteAbbrev", // string | null (now consistent across both types)
  "VesselPositionNum", // number | null
];
