import type { ActionCtx } from "_generated/server";
import { api } from "../../_generated/api";
import type { ConvexVesselLocation } from "./schemas";

/**
 * Internal action for fetching and storing vessel locations from WSF API
 * This is called by cron jobs and makes external HTTP requests
 * Stores data without any filtering or transforming
 */
export const storeVesselLocations = async (
  ctx: ActionCtx,
  currentLocations: ConvexVesselLocation[]
) => {
  // Store locations to database using bulk upsert to replace existing records by VesselID
  await ctx.runMutation(api.functions.vesselLocation.mutations.bulkUpsert, {
    locations: currentLocations,
  });
};
