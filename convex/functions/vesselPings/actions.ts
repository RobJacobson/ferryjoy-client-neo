/**
 * Convex actions for ingesting and retaining vessel ping collections.
 */

import { api, internal } from "_generated/api";
import { internalAction } from "_generated/server";
import { fetchInServiceWsfVesselPings } from "adapters";
import type { VesselIdentity } from "functions/vesselIdentities/schemas";

/**
 * Internal action for fetching and storing vessel pings from the WSF API.
 *
 * @param ctx - Convex internal action context
 * @returns Failure details when ingestion fails; otherwise `undefined`
 */
export const fetchAndStoreVesselPings = internalAction({
  args: {},
  handler: async (ctx) => {
    try {
      const vessels = (await ctx.runQuery(
        internal.functions.vesselLocation.queries.getAllBackendVesselsInternal
      )) satisfies ReadonlyArray<VesselIdentity>;

      const vesselPings = await fetchInServiceWsfVesselPings(vessels);

      // Store the vessel pings through mutation.
      await ctx.runMutation(
        api.functions.vesselPings.mutations.storeVesselPings,
        {
          pings: vesselPings,
        }
      );
    } catch (error) {
      const normalized =
        error instanceof Error ? error : new Error(safeSerialize(error));
      console.error("fetchAndStoreVesselPings failed:", normalized);
      return {
        success: false,
        error: normalized.message,
      };
    }
  },
});

/**
 * Internal action for pruning old vessel ping collection rows.
 *
 * @param ctx - Convex internal action context
 * @returns `undefined` after the cleanup mutation completes
 */
export const cleanupOldPings = internalAction({
  args: {},
  handler: async (ctx) => {
    await ctx.runMutation(
      internal.functions.vesselPings.mutations.cleanupOldPingsMutation
    );
  },
});

/**
 * Serialize unknown error values for logging without throwing during logging.
 *
 * @param value - Unknown value caught from an action failure path
 * @returns String form suitable for error messages and console output
 */
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
