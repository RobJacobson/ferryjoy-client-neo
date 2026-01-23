import { internalMutation, mutation } from "_generated/server";
import { ConvexError, v } from "convex/values";
import { type ConvexScheduledTrip, scheduledTripSchema } from "./schemas";

/**
 * Deletes all scheduled trips for a specific sailing day.
 * Used during sync operations to clear old data before inserting fresh schedule data.
 * @param ctx - Convex mutation context
 * @param args.sailingDay - The sailing day in YYYY-MM-DD format to delete trips for
 * @returns Object containing the number of trips deleted
 */
export const deleteScheduledTripsForDate = mutation({
  args: {
    sailingDay: v.string(),
  },
  handler: async (ctx, args: { sailingDay: string }) => {
    try {
      // Query all trips for this sailing day
      const tripsToDelete = await ctx.db
        .query("scheduledTrips")
        .withIndex("by_sailing_day", (q) => q.eq("SailingDay", args.sailingDay))
        .collect();

      // Delete each trip
      let deletedCount = 0;
      for (const trip of tripsToDelete) {
        await ctx.db.delete(trip._id);
        deletedCount++;
      }

      return { deleted: deletedCount };
    } catch (error) {
      throw new ConvexError({
        message: `Failed to delete scheduled trips for ${args.sailingDay}`,
        code: "DELETE_SCHEDULED_TRIPS_FOR_DATE_FAILED",
        severity: "error",
        details: {
          sailingDay: args.sailingDay,
          error: String(error),
        },
      });
    }
  },
});

/**
 * Bulk insert scheduled trips without deduplication logic.
 * Assumes the caller has already classified trips as direct/indirect via classification.
 * Used during sync operations to populate fresh schedule data.
 *
 * @param ctx - Convex mutation context
 * @param args.trips - Array of scheduled trip objects to insert into the database
 * @returns Object containing the number of trips successfully inserted
 */
export const insertScheduledTrips = mutation({
  args: { trips: v.array(scheduledTripSchema) },
  handler: async (ctx, args: { trips: ConvexScheduledTrip[] }) => {
    try {
      // Insert all trips (classification has already set TripType)
      for (const trip of args.trips) {
        await ctx.db.insert("scheduledTrips", trip);
      }

      return { inserted: args.trips.length };
    } catch (error) {
      throw new ConvexError({
        message: `Failed to insert scheduled trips`,
        code: "INSERT_SCHEDULED_TRIPS_FAILED",
        severity: "error",
        details: {
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
 * This is intentionally batched so the caller can loop from an action without
 * running an oversized mutation.
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
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit, 1000));

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
