/**
 * Actions that orchestrate keyValueStore migrations (no direct DB access).
 */

import { internal } from "_generated/api";
import { internalAction } from "_generated/server";
import { v } from "convex/values";

import { keyValueStoreValueValidator } from "./schemas";

type SyncDateSetupResult = {
  created: boolean;
  timestamp: string | number | boolean | null;
};

type RunAllSetupResult = {
  syncDateSetup: SyncDateSetupResult;
};

/**
 * Runs key-value setup mutations in sequence for backend bootstrap.
 *
 * Currently invokes `setupInitialSyncDate` so scheduled-trips tooling has a
 * baseline `lastScheduledTripsSyncDate` before first sync.
 *
 * @param ctx - Convex action context
 * @returns Result object containing scheduled-trips sync-date setup outcome
 */
export const runAllSetup = internalAction({
  args: {},
  returns: v.object({
    syncDateSetup: v.object({
      created: v.boolean(),
      timestamp: keyValueStoreValueValidator,
    }),
  }),
  handler: async (ctx): Promise<RunAllSetupResult> => {
    console.log("[SETUP] Running key-value setup");

    const syncResult: SyncDateSetupResult = await ctx.runMutation(
      internal.functions.keyValueStore.migrations.setupInitialSyncDate,
      {}
    );
    console.log("[SETUP] Sync date setup result:", syncResult);

    return {
      syncDateSetup: syncResult,
    };
  },
});
