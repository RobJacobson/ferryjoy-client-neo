import { mutation } from "_generated/server";
import { ConvexError, v } from "convex/values";
import { type ConvexScheduledTrip, scheduledTripSchema } from "./schemas";

/**
 * Deletes all scheduled trips for a specific sailing day
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
 * Bulk insert scheduled trips with automatic deduplication by Key
 * Removes older duplicates when inserting new data for the same logical trip
 */
export const insertScheduledTrips = mutation({
  args: { trips: v.array(scheduledTripSchema) },
  handler: async (ctx, args: { trips: ConvexScheduledTrip[] }) => {
    try {
      let inserted = 0;
      let deduplicated = 0;

      for (const trip of args.trips) {
        // Check if a trip with this key already exists
        const existing = await ctx.db
          .query("scheduledTrips")
          .withIndex("by_key", (q) => q.eq("Key", trip.Key))
          .first();

        if (existing) {
          // Replace existing trip with new data
          await ctx.db.replace(existing._id, trip);
          deduplicated++;
        } else {
          // Insert new trip
          await ctx.db.insert("scheduledTrips", trip);
          inserted++;
        }
      }

      return { inserted, deduplicated };
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
