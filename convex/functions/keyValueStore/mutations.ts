/**
 * Mutations for the keyValueStore table.
 */

import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import { upsertByKey } from "./helpers";
import { keyValueStoreValueValidator } from "./schemas";

/**
 * Inserts or replaces a row for the given key.
 *
 * @param ctx - Convex mutation context
 * @param args.key - Document key
 * @param args.value - Stored value
 * @param args.updatedAt - Optional epoch ms for updatedAt (defaults to now)
 * @returns `null` after the upsert completes
 */
export const upsert = internalMutation({
  args: {
    key: v.string(),
    value: keyValueStoreValueValidator,
    updatedAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await upsertByKey(ctx, args.key, args.value, args.updatedAt);
    return null;
  },
});
