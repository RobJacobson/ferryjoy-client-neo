/**
 * Internal mutations for the `keyValueStore` table. Writes go through these
 * entrypoints (or helpers they call) so actions and migrations share validation
 * and upsert behavior with one Convex `returns` contract per operation.
 */

import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import { upsertByKey } from "./helpers";
import { keyValueStoreValueValidator } from "./schemas";

/**
 * Performs a generic upsert into `keyValueStore` by key.
 *
 * Delegates to `upsertByKey` so actions and migrations share one write path with
 * optional explicit `updatedAt` timestamps.
 *
 * @param ctx - Convex mutation context
 * @param args.key - Document key
 * @param args.value - Stored value
 * @param args.updatedAt - Optional epoch ms for `updatedAt` (defaults to now)
 * @returns `null` (Convex surface for “no return payload” once the upsert completes)
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
