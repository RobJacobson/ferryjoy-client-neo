/**
 * @fileoverview Helper functions for tracking scheduled trips sync timestamps
 *
 * Provides utilities to persist and retrieve the last successful sync timestamp.
 * This is used to detect when the WSF API has been updated since our last sync.
 */

import { internalMutation, internalQuery } from "_generated/server";

/**
 * Key used in the key-value store for the last sync date timestamp.
 */
const SYNC_DATE_KEY = "lastScheduledTripsSyncDate";

/**
 * Sets the timestamp of the last successful scheduled trips sync.
 * Called after any successful sync operation completes.
 *
 * @param ctx - Convex internal mutation context
 */
export const setLastSyncDate = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("keyValueStore")
      .withIndex("by_key", (q) => q.eq("key", SYNC_DATE_KEY))
      .first();

    const entry = {
      key: SYNC_DATE_KEY,
      value: Date.now(),
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.replace(existing._id, entry);
    } else {
      await ctx.db.insert("keyValueStore", entry);
    }
  },
});

/**
 * Gets the timestamp of the last successful scheduled trips sync.
 * Returns undefined if no sync has been recorded.
 *
 * @param ctx - Convex internal query context
 * @returns Epoch milliseconds of last sync, or undefined if never synced
 */
export const getLastSyncDate = internalQuery({
  args: {},
  handler: async (ctx): Promise<number | null | undefined> => {
    const entry = await ctx.db
      .query("keyValueStore")
      .withIndex("by_key", (q) => q.eq("key", SYNC_DATE_KEY))
      .first();

    return entry?.value as number | null | undefined;
  },
});
