/**
 * Internal setup and one-off mutations that seed or adjust `keyValueStore` rows
 * for operational workflows (for example scheduled-trips sync baselines). These
 * are idempotent where noted so repeated bootstrap does not corrupt state.
 */

import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import { fetchEntryByKey } from "./helpers";
import {
  KEY_LAST_SCHEDULED_TRIPS_SYNC_DATE,
  keyValueStoreValueValidator,
} from "./schemas";

/**
 * Seeds `lastScheduledTripsSyncDate` once if the key is missing.
 *
 * Idempotent: returns the existing value when already present so repeated setup
 * actions do not shift the baseline. Uses epoch ms for "yesterday" (24 hours
 * before `Date.now()`) when creating the row.
 *
 * @param ctx - Convex mutation context
 * @returns `created` false when the row already existed, true when inserted;
 *   `timestamp` is always the stored scalar value for that key afterward
 */
export const setupInitialSyncDate = internalMutation({
  args: {},
  returns: v.object({
    created: v.boolean(),
    timestamp: keyValueStoreValueValidator,
  }),
  handler: async (ctx) => {
    console.log("[SETUP] Setting up initial sync date for scheduled trips");

    const existingSyncDate = await fetchEntryByKey(
      ctx,
      KEY_LAST_SCHEDULED_TRIPS_SYNC_DATE
    );

    if (existingSyncDate) {
      console.log(
        "[SETUP] Sync date already exists:",
        new Date(Number(existingSyncDate.value)).toISOString()
      );
      return {
        created: false,
        timestamp: existingSyncDate.value,
      };
    }

    const yesterday = Date.now() - 24 * 60 * 60 * 1000;
    const entry = {
      key: KEY_LAST_SCHEDULED_TRIPS_SYNC_DATE,
      value: yesterday,
      updatedAt: Date.now(),
    };

    await ctx.db.insert("keyValueStore", entry);
    console.log(
      "[SETUP] Set initial sync date to:",
      new Date(yesterday).toISOString()
    );

    return {
      created: true,
      timestamp: yesterday,
    };
  },
});
