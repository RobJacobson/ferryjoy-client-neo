import type { VesselLocation as DottieVesselLocation } from "ws-dottie/wsf-vessels/core";
import { fetchVesselLocations } from "ws-dottie/wsf-vessels/core";
import { api } from "_generated/api";
import { internalAction } from "_generated/server";
import { convertConvexVesselLocation } from "shared/convertVesselLocations";
import { toConvexVesselLocation } from "functions/vesselLocation/schemas";

/**
 * Runs every 5 seconds to fetch vessel locations and update related data
 * 1. Fetches vesselLocation data from fetchVesselLocations
 * 2. Converts to convex vessel location and stores to database using bulk upsert
 */
export const updateVesselLocations = internalAction({
  args: {},
  handler: async (ctx) => {
    // 1. Fetch vesselLocation data from fetchVesselLocations
    const vesselLocations = (
      (await fetchVesselLocations()) as unknown as DottieVesselLocation[]
    )
      .map(toConvexVesselLocation)
      .map(convertConvexVesselLocation);

    // 2. Store locations to database using bulk upsert
    await ctx.runMutation(api.functions.vesselLocation.mutations.bulkUpsert, {
      locations: vesselLocations,
    });
  },
});
