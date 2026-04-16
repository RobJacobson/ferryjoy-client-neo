/**
 * Convex actions for ingesting and cleaning up vessel ping rows.
 */

import { api, internal } from "_generated/api";
import { internalAction } from "_generated/server";
import { fetchWsfVesselLocations } from "adapters/wsf/fetchVesselLocations";
import { toConvexVesselPing } from "functions/vesselPings/schemas";

/**
 * Internal action for fetching and storing vessel locations from the WSF API.
 *
 * @param ctx - Convex internal action context
 * @returns `undefined` after individual vessel ping rows are stored
 */
export const fetchAndStoreVesselPing = internalAction({
  args: {},
  handler: async (ctx) => {
    const rawLocations = await fetchWsfVesselLocations();

    const vesselPings = rawLocations
      .filter((vl) => vl.InService)
      .map(toConvexVesselPing)
      .sort((a, b) => b.VesselID - a.VesselID);

    if (vesselPings.length === 0) {
      throw new Error("No vessel locations received from WSF API");
    }

    await ctx.runMutation(api.functions.vesselPing.mutations.storeVesselPings, {
      pings: vesselPings,
    });
  },
});

/**
 * Internal action for pruning old legacy vessel ping rows.
 *
 * @param ctx - Convex internal action context
 * @returns `undefined` after the cleanup mutation completes
 */
export const cleanupOldPings = internalAction({
  args: {},
  handler: async (ctx) => {
    await ctx.runMutation(
      internal.functions.vesselPing.mutations.cleanupOldPingsMutation
    );
  },
});
