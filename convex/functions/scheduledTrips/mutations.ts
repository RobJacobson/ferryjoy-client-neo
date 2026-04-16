/**
 * Internal persistence for scheduled trips: atomic day replace and batched purge.
 */

import { internalMutation } from "_generated/server";
import { ConvexError, v } from "convex/values";
import { scheduledTripsConfig } from "./constants";
import { type ConvexScheduledTrip, scheduledTripSchema } from "./schemas";

const replaceScheduledTripsResult = v.object({
  deleted: v.number(),
  inserted: v.number(),
});

const deleteScheduledTripsBatchResult = v.object({
  deleted: v.number(),
  hasMore: v.boolean(),
});

/**
 * Atomically replaces all scheduled trips for one sailing day: delete existing
 * rows for that day, then insert the provided snapshot. Used by sync actions
 * so delete and insert run in a single mutation transaction.
 *
 * @param ctx - Convex internal mutation context
 * @param args.sailingDay - WSF sailing day in YYYY-MM-DD format
 * @param args.trips - Full replacement set for that day
 * @returns Counts of deleted and inserted documents
 */
export const replaceScheduledTripsForSailingDay = internalMutation({
  args: {
    sailingDay: v.string(),
    trips: v.array(scheduledTripSchema),
  },
  returns: replaceScheduledTripsResult,
  handler: async (
    ctx,
    args: { sailingDay: string; trips: ConvexScheduledTrip[] }
  ) => {
    try {
      const existing = await ctx.db
        .query("scheduledTrips")
        .withIndex("by_sailing_day", (q) => q.eq("SailingDay", args.sailingDay))
        .collect();

      for (const trip of existing) {
        await ctx.db.delete(trip._id);
      }

      for (const trip of args.trips) {
        await ctx.db.insert("scheduledTrips", trip);
      }

      return {
        deleted: existing.length,
        inserted: args.trips.length,
      };
    } catch (error) {
      throw new ConvexError({
        message: `Failed to replace scheduled trips for ${args.sailingDay}`,
        code: "REPLACE_SCHEDULED_TRIPS_FOR_SAILING_DAY_FAILED",
        severity: "error",
        details: {
          sailingDay: args.sailingDay,
          tripCount: args.trips.length,
          error: String(error),
        },
      });
    }
  },
});

/**
 * Delete a batch of scheduled trips that depart before a cutoff time.
 * Used by a daily internal purge job to keep ScheduledTrips bounded.
 *
 * @param ctx - Convex mutation context
 * @param args.cutoffMs - Epoch ms cutoff; delete trips with DepartingTime < cutoffMs
 * @param args.limit - Maximum number of docs to delete in this batch
 * @returns Batch deletion summary
 */
export const deleteScheduledTripsBeforeBatch = internalMutation({
  args: {
    cutoffMs: v.number(),
    limit: v.number(),
  },
  returns: deleteScheduledTripsBatchResult,
  handler: async (ctx, args) => {
    const limit = Math.max(
      1,
      Math.min(args.limit, scheduledTripsConfig.purgeBatchLimitMax)
    );

    const tripsToDelete = await ctx.db
      .query("scheduledTrips")
      .withIndex("by_departing_time", (q) =>
        q.lt("DepartingTime", args.cutoffMs)
      )
      .take(limit);

    for (const trip of tripsToDelete) {
      await ctx.db.delete(trip._id);
    }

    return {
      deleted: tripsToDelete.length,
      hasMore: tripsToDelete.length === limit,
    };
  },
});
