/**
 * Queries for the keyValueStore table.
 */

import { internalQuery, query } from "_generated/server";
import { ConvexError, v } from "convex/values";
import { fetchEntryByKey, getProductionVersionTagValue } from "./helpers";
import { keyValueStoreDocValidator } from "./schemas";

/**
 * Returns the active ML production version tag for clients.
 *
 * Reads `KEY_PRODUCTION_VERSION_TAG` via `getProductionVersionTagValue` and wraps
 * failures in `ConvexError` for consistent API error shapes.
 *
 * @param ctx - Convex query context
 * @returns Version tag string or `null` when not configured
 */
export const getProductionVersionTag = query({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async (ctx) => {
    try {
      return await getProductionVersionTagValue(ctx);
    } catch (error) {
      throw new ConvexError({
        message: "Failed to fetch production version tag from config",
        code: "QUERY_FAILED",
        severity: "error",
        details: { configKey: "productionVersionTag", error: String(error) },
      });
    }
  },
});

/**
 * Internal lookup for one `keyValueStore` row by key.
 *
 * Returns the full document (including `_id`) for actions that need precise row
 * identity; use `fetchEntryByKey` inside mutations when already in a write txn.
 *
 * @param ctx - Convex query context
 * @param args.key - Key to resolve
 * @returns Full document or `null`
 */
export const getEntryByKey = internalQuery({
  args: { key: v.string() },
  returns: v.union(keyValueStoreDocValidator, v.null()),
  handler: async (ctx, args) => await fetchEntryByKey(ctx, args.key),
});
