/**
 * Defines internal mutations for historic vessel-location snapshots.
 */
import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import type { ConvexHistoricVesselLocation } from "./schemas";
import { historicVesselLocationValidationSchema } from "./schemas";

/**
 * Inserts a batch of historic vessel-location snapshot rows.
 *
 * Sequential inserts keep the mutation simple; volume is bounded by one capture
 * tick’s vessel count.
 *
 * @param ctx - Convex mutation context
 * @param args.locations - Historic vessel-location rows to insert
 * @returns Insert summary for the captured snapshot
 */
export const insertSnapshotBatch = internalMutation({
  args: {
    locations: v.array(historicVesselLocationValidationSchema),
  },
  returns: v.object({
    inserted: v.number(),
  }),
  handler: async (ctx, args: { locations: ConvexHistoricVesselLocation[] }) => {
    for (const location of args.locations) {
      await ctx.db.insert("vesselLocationsHistoric", location);
    }

    return {
      inserted: args.locations.length,
    };
  },
});

/**
 * Deletes one batch of historic rows with `SailingDay` before a cutoff.
 *
 * Uses `by_sailing_day` with `lt`; `hasMore` is true when the batch filled
 * `limit` so the action can loop.
 *
 * @param ctx - Convex mutation context
 * @param args.cutoffSailingDay - Oldest sailing day to retain; older rows delete
 * @param args.limit - Maximum number of rows to delete in this batch
 * @returns Batch deletion summary
 */
export const deleteHistoricLocationsBeforeSailingDayBatch = internalMutation({
  args: {
    cutoffSailingDay: v.string(),
    limit: v.number(),
  },
  returns: v.object({
    deleted: v.number(),
    hasMore: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit, 1000));

    const docs = await ctx.db
      .query("vesselLocationsHistoric")
      .withIndex("by_sailing_day", (q) =>
        q.lt("SailingDay", args.cutoffSailingDay)
      )
      .take(limit);

    for (const doc of docs) {
      await ctx.db.delete(doc._id);
    }

    return {
      deleted: docs.length,
      hasMore: docs.length === limit,
    };
  },
});
