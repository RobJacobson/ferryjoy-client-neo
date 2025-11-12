import { fetchVesselLocations } from "ws-dottie/wsf-vessels/core";
import { api } from "../../_generated/api";
import { internalAction } from "../../_generated/server";
import { toConvexVesselLocation } from "../vesselLocation/schemas";
import type { CurrentVesselLocation } from "./schemas";

/**
 * Scheduled action to update current vessel locations
 */
export const updateCurrentVesselLocations = internalAction({
  args: {},
  handler: async (ctx): Promise<{ updated: number }> => {
    // 1. Fetch the latest vessel locations
    const latestLocations = (await fetchVesselLocations()).map(
      toConvexVesselLocation
    );

    // 2. Get the existing currentVesselLocations
    const existingLocations: CurrentVesselLocation[] = await ctx.runQuery(
      api.functions.currentVesselLocation.queries.getAll
    );

    // Create a map of existing locations by VesselID for efficient lookup
    const existingByVesselId = new Map<number, CurrentVesselLocation>(
      existingLocations.map((loc: CurrentVesselLocation) => [loc.VesselID, loc])
    );

    // 3. Compare and identify new or updated locations
    const locationsToUpsert: CurrentVesselLocation[] = latestLocations.filter(
      (latest: CurrentVesselLocation) => {
        const existing = existingByVesselId.get(latest.VesselID);
        // If vessel doesn't exist or has a newer timestamp, include it
        return !existing || latest.TimeStamp > existing.TimeStamp;
      }
    );

    // 4. Upsert new or updated locations
    if (locationsToUpsert.length > 0) {
      await ctx.runMutation(
        api.functions.currentVesselLocation.mutations.bulkUpsert,
        { locations: locationsToUpsert }
      );
    }

    return { updated: locationsToUpsert.length };
  },
});
