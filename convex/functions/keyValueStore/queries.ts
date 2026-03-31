/**
 * Queries for the keyValueStore table.
 */

import { internalQuery, query } from "_generated/server";
import { ConvexError, v } from "convex/values";
import { fetchEntryByKey, getProductionVersionTagValue } from "./helpers";
import { keyValueStoreDocValidator } from "./schemas";

/**
 * Returns the active ML production version tag, or null when not configured.
 *
 * @param ctx - Convex query context
 * @returns Version tag string or null
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
 * Internal lookup for a key-value row (e.g. actions calling into the DB).
 *
 * @param ctx - Convex query context
 * @param args.key - Key to resolve
 * @returns Full document or null
 */
export const getEntryByKey = internalQuery({
  args: { key: v.string() },
  returns: v.union(keyValueStoreDocValidator, v.null()),
  handler: async (ctx, args) => await fetchEntryByKey(ctx, args.key),
});
