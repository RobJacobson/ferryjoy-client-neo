/**
 * One-off migrations and setup mutations that use keyValueStore.
 */

import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import { fetchEntryByKey } from "./helpers";
import {
  KEY_LAST_SCHEDULED_TRIPS_SYNC_DATE,
  keyValueStoreValueValidator,
} from "./schemas";

/**
 * Seeds lastScheduledTripsSyncDate once so cache-flush tooling can run.
 *
 * @param ctx - Convex mutation context
 * @returns Whether a new row was created and the stored timestamp value
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
