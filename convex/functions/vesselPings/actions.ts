/**
 * Convex actions for ingesting and retaining vessel ping collections.
 */

import { api, internal } from "_generated/api";
import { internalAction } from "_generated/server";
import { fetchWsfVesselPings } from "adapters";
import type { VesselIdentity } from "functions/vessels/schemas";

const CLEANUP_OLD_PINGS_BATCH_SIZE = 200;

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

      const vesselPings = await fetchWsfVesselPings(vessels);

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
 * @returns Total rows deleted across cleanup batches
 */
export const cleanupOldPings = internalAction({
  args: {},
  handler: async (ctx) => {
    const cutoffMs = Date.now() - 60 * 60 * 1_000;
    let totalDeleted = 0;
    let batchCount = 0;

    while (true) {
      const result = await ctx.runMutation(
        internal.functions.vesselPings.mutations.cleanupOldPingsMutation,
        {
          cutoffMs,
          limit: CLEANUP_OLD_PINGS_BATCH_SIZE,
        }
      );

      batchCount += 1;
      totalDeleted += result.deleted;

      console.log("[vesselPings.cleanupOldPings] batch processed", {
        batchCount,
        batchDeleted: result.deleted,
        totalDeleted,
        hasMore: result.hasMore,
      });

      if (!result.hasMore) {
        break;
      }
    }

    console.log("[vesselPings.cleanupOldPings] run complete", {
      batchCount,
      totalDeleted,
      cutoffMs,
    });

    return totalDeleted;
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
