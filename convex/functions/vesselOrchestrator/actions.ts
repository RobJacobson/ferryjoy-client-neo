import { api, internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { internalAction } from "_generated/server";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import { toConvexVesselLocation } from "functions/vesselLocation/schemas";
import { runUpdateVesselTrips } from "functions/vesselTrips/updates";
import { convertConvexVesselLocation } from "shared/convertVesselLocations";
import { enrichConvexVesselLocation } from "shared/enrichConvexVesselLocations";
import { fetchWsfVesselLocations } from "shared/fetchWsfVesselLocations";
import type { VesselLocation as DottieVesselLocation } from "ws-dottie/wsf-vessels/core";

/**
 * Orchestrator action that fetches vessel locations once and delegates to both
 * updateVesselLocations and updateVesselTrips subroutines with robust error isolation.
 *
 * This action eliminates duplicate API calls by fetching vessel locations once,
 * then passing the same converted data to both processing functions. Failures
 * in one function do not prevent the other from executing.
 *
 * Flow:
 * 1. Fetch vessel locations via fetchVesselLocations()
 * 2. Convert: toConvexVesselLocation() → convertConvexVesselLocation()
 * 3. Call updateVesselLocations() with error isolation
 * 4. Call runUpdateVesselTrips() with error isolation
 *
 * @param ctx - Convex action context
 * @returns Result object indicating success/failure of each subroutine
 */
export const updateVesselOrchestrator = internalAction({
  args: {},
  handler: async (ctx) => {
    let locationsSuccess = false;
    let tripsSuccess = false;
    let tripEventsSuccess = false;
    // Track errors from each processing branch
    const errors: {
      fetch?: { message: string; stack?: string };
      locations?: { message: string; stack?: string };
      trips?: { message: string; stack?: string };
      tripEvents?: { message: string; stack?: string };
    } = {};

    // Step 1: Fetch and convert vessel locations
    let convexLocations: ConvexVesselLocation[] = [];

    try {
      const rawLocations =
        (await fetchWsfVesselLocations()) as unknown as DottieVesselLocation[];

      // Transform chain: WSF API → Convex schema → enrich with distances → final format
      convexLocations = rawLocations
        .map(toConvexVesselLocation)
        .map(enrichConvexVesselLocation)
        .map(convertConvexVesselLocation);
    } catch (error) {
      const err = normalizeError(error);
      errors.fetch = { message: err.message, stack: err.stack };
      console.error("Failed to fetch or process vessel locations:", err);

      return {
        locationsSuccess,
        tripsSuccess,
        tripEventsSuccess,
        errors,
      };
    }

    // Step 2: Update vessel location database (error isolated)
    try {
      await updateVesselLocations(ctx, convexLocations);
      locationsSuccess = true;
    } catch (error) {
      const err = normalizeError(error);
      errors.locations = { message: err.message, stack: err.stack };
      console.error("updateVesselLocations failed:", err);
    }

    // Step 3: Update vessel trips (error isolated from location updates)
    try {
      await runUpdateVesselTrips(ctx, convexLocations);
      tripsSuccess = true;
    } catch (error) {
      const err = normalizeError(error);
      errors.trips = { message: err.message, stack: err.stack };
      console.error("runUpdateVesselTrips failed:", err);
    }

    // Step 4: Update vessel trip events (error isolated from other branches)
    try {
      await ctx.runMutation(
        internal.functions.vesselTripEvents.mutations.applyLiveUpdates,
        {
          Locations: convexLocations,
        }
      );
      tripEventsSuccess = true;
    } catch (error) {
      const err = normalizeError(error);
      errors.tripEvents = { message: err.message, stack: err.stack };
      console.error("applyLiveUpdates failed:", err);
    }

    return {
      locationsSuccess,
      tripsSuccess,
      tripEventsSuccess,
      ...(Object.keys(errors).length > 0 ? { errors } : {}),
    };
  },
});

/**
 * Subroutine function for updating vessel locations in the database.
 *
 * Stores vessel locations to the database using bulk upsert mutation.
 * This is called as a subroutine within the orchestrator action.
 *
 * @param ctx - Convex action context for database operations
 * @param locations - Array of vessel locations to store
 */
async function updateVesselLocations(
  ctx: ActionCtx,
  locations: ConvexVesselLocation[]
): Promise<void> {
  await ctx.runMutation(api.functions.vesselLocation.mutations.bulkUpsert, {
    locations,
  });
}

const normalizeError = (error: unknown) => {
  if (error instanceof Error) {
    return error;
  }

  return new Error(safeSerialize(error));
};

const safeSerialize = (value: unknown) => {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};
