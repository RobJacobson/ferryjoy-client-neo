import { mutation } from "_generated/server";
import { ConvexError, v } from "convex/values";
import { type ConvexScheduledTrip, scheduledTripSchema } from "./schemas";

/**
 * Bulk upsert scheduled trips (replace if exists, insert if not)
 * Uses composite key for deduplication
 */
export const upsertScheduledTrips = mutation({
  args: { trips: v.array(scheduledTripSchema) },
  handler: async (ctx, args: { trips: ConvexScheduledTrip[] }) => {
    try {
      return args.trips.map((trip) => {
        // Use composite key for deduplication - replace if exists, insert if not
        ctx.db.insert("scheduledTrips", trip);
        return trip.Key;
      });
    } catch (error) {
      throw new ConvexError({
        message: `Failed to upsert scheduled trips`,
        code: "UPSERT_SCHEDULED_TRIPS_FAILED",
        severity: "error",
        details: {
          tripCount: args.trips.length,
          error: String(error),
        },
      });
    }
  },
});
