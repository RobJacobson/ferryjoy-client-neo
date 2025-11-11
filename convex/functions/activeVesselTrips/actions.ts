import { fetchVesselLocations } from "ws-dottie/wsf-vessels/core";
import { api, internal } from "../../_generated/api";
import type { Doc } from "../../_generated/dataModel";
import { type ActionCtx, internalAction } from "../../_generated/server";
import {
  type ConvexVesselLocation,
  toConvexVesselLocation,
} from "../vesselLocation/schemas";
import {
  type ConvexActiveVesselTrip,
  toConvexActiveVesselTrip,
} from "./schemas";

// Special value for the first incomplete trip for each vessel
// Equals 2020-01-01 00:00:00 UTC
const FIRST_TRIP_START_MS = 1577836800000;

/**
 * Main action for updating active vessel trips
 * Fetches current vessel locations and updates the activeVesselTrips table
 * Triggers completedVesselTrips action when trips are completed
 * This action runs on a cron job every 15 seconds to keep vessel trip data current.
 */
export const updateActiveVesselTrips = internalAction({
  args: {},
  handler: async (ctx) => {
    // Fetch current vessel locations from WSF API
    const currentLocations = (await fetchVesselLocations()).map(
      toConvexVesselLocation
    );

    // Get existing active trips from database
    const existingTrips = (await ctx.runQuery(
      api.functions.activeVesselTrips.queries.getActiveTrips
    )) as Array<Doc<"activeVesselTrips">>;

    // Process each vessel location sequentially with error handling
    for (const location of currentLocations) {
      try {
        const existingTrip = existingTrips.find(
          (trip) => trip.VesselID === location.VesselID
        );

        if (!existingTrip) {
          // Create new trip
          await createNewActiveTrip(ctx, location, FIRST_TRIP_START_MS);
        } else if (hasTripCompleted(existingTrip, location)) {
          // Trip has completed - move to completed and create new active trip
          await ctx.runAction(
            internal.functions.completedVesselTrips.actions
              .addCompletedVesselTrip,
            {
              activeTrip: existingTrip,
              endTime: location.TimeStamp,
            }
          );

          // Create new active trip for the next journey
          await createNewActiveTrip(ctx, location, location.TimeStamp);
        } else {
          // Update existing trip
          await updateExistingTrip(ctx, existingTrip, location);
        }
      } catch (error) {
        // Log the error but continue processing other vessel trips
        console.error(
          `Failed to process vessel trip for vessel ${location.VesselID} (${location.VesselName}):`,
          error
        );
      }
    }
  },
});

/**
 * Determines if a trip has completed based on terminal changes
 */
const hasTripCompleted = (
  activeTrip: Doc<"activeVesselTrips">,
  currentLocation: ConvexVesselLocation
): boolean => {
  return activeTrip.DepartingTerminalID !== currentLocation.DepartingTerminalID;
};

/**
 * Creates a new active trip from vessel location data
 * Ensures uniqueness by deleting any existing active trips for this vessel first
 */
const createNewActiveTrip = async (
  ctx: ActionCtx,
  location: ConvexVesselLocation,
  tripStart: number
): Promise<void> => {
  const newTrip = toConvexActiveVesselTrip(location, tripStart);

  // Ensure uniqueness by removing any existing active trips for this vessel
  await ctx.runMutation(
    api.functions.activeVesselTrips.mutations.deleteByVesselId,
    {
      vesselId: location.VesselID,
    }
  );

  // Insert the new trip
  await ctx.runMutation(api.functions.activeVesselTrips.mutations.insert, {
    trip: newTrip,
  });

  console.log(
    `New trip for ${newTrip.VesselAbbrev} (${newTrip.VesselID}): ${JSON.stringify(newTrip)}`
  );
};

/**
 * Updates an existing active trip with new location data
 * Only updates if data has changed and is newer than current trip
 */
const updateExistingTrip = async (
  ctx: ActionCtx,
  existingTrip: Doc<"activeVesselTrips">,
  location: ConvexVesselLocation
): Promise<void> => {
  // Ensure the location data is for the same vessel and is newer
  if (
    location.TimeStamp <= existingTrip.TimeStamp ||
    location.VesselID !== existingTrip.VesselID
  ) {
    return;
  }

  // Get updated trip data
  const updatedTripData = getUpdatedTripData(existingTrip, location);

  // Special handling for LeftDockActual when leaving dock
  if (existingTrip.AtDock && !location.AtDock) {
    updatedTripData.LeftDockActual = location.TimeStamp;
  }

  // Return early if none of the relevant fields have changed
  if (Object.keys(updatedTripData).length === 0) {
    return;
  }

  // Convert Doc to ConvexActiveVesselTrip for the mutation
  const { _id, _creationTime, ...tripFields } = existingTrip;
  const tripToUpdate: ConvexActiveVesselTrip = {
    ...tripFields,
    ...updatedTripData,
    TimeStamp: location.TimeStamp,
  };

  // Update the trip in the database
  await ctx.runMutation(api.functions.activeVesselTrips.mutations.update, {
    trip: tripToUpdate,
  });

  console.log(
    `Update for ${existingTrip.VesselAbbrev} (${existingTrip.VesselID}): ${JSON.stringify(updatedTripData)}`
  );
};

/**
 * Gets updated trip data by comparing existing trip with new location
 * Returns only fields that have changed
 */
const getUpdatedTripData = (
  existingTrip: Doc<"activeVesselTrips">,
  location: ConvexVesselLocation
): Partial<ConvexActiveVesselTrip> => {
  const updatedTrip: Partial<ConvexActiveVesselTrip> = {};

  // Update common fields that have changed
  commonFields.forEach((field) => {
    const locationValue = location[field];
    const tripValue = existingTrip[field];

    if (tripValue !== locationValue) {
      // Safe type assertion since we know the field exists in both types
      (updatedTrip as Record<string, unknown>)[field] = locationValue;
    }
  });

  return updatedTrip;
};

// Fields present in both ActiveVesselTrip and VesselLocation
const commonFields: Array<
  keyof ConvexActiveVesselTrip & keyof ConvexVesselLocation
> = [
  "VesselID",
  "VesselName",
  "DepartingTerminalID",
  "DepartingTerminalName",
  "DepartingTerminalAbbrev",
  "ArrivingTerminalID",
  "ArrivingTerminalName",
  "ArrivingTerminalAbbrev",
  "InService",
  "AtDock",
  "ScheduledDeparture",
  "LeftDock",
  "Eta",
  "OpRouteAbbrev",
  "VesselPositionNum",
];
