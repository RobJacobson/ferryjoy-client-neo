import { mutation } from "_generated/server";
import { ConvexError, v } from "convex/values";
import { type ConvexScheduledTrip, scheduledTripSchema } from "./schemas";

/**
 * Type for scheduled trip document as returned from database queries
 * Includes _id and _creationTime fields
 */
type ScheduledTripDoc = ConvexScheduledTrip & {
  _id: string;
  _creationTime: number;
};

/**
 * Utility function to compare trips for equality
 * Used to determine if an update is needed
 * Excludes _id and _creationTime fields from comparison
 */
function tripsEqual(a: ScheduledTripDoc, b: ConvexScheduledTrip): boolean {
  // Compare all fields except _id and _creationTime
  return (
    a.Key === b.Key &&
    a.VesselAbbrev === b.VesselAbbrev &&
    a.DepartingTerminalAbbrev === b.DepartingTerminalAbbrev &&
    a.ArrivingTerminalAbbrev === b.ArrivingTerminalAbbrev &&
    a.DepartingTime === b.DepartingTime &&
    a.ArrivingTime === b.ArrivingTime &&
    a.SailingNotes === b.SailingNotes &&
    JSON.stringify(a.Annotations) === JSON.stringify(b.Annotations) &&
    a.RouteID === b.RouteID &&
    a.RouteAbbrev === b.RouteAbbrev &&
    a.SailingDay === b.SailingDay
  );
}

/**
 * Synchronizes scheduled trips for a single route atomically
 * Handles inserts, updates, and deletes in one transaction
 * Ensures database exactly matches provided trip data
 */
export const syncScheduledTripsForRoute = mutation({
  args: {
    routeId: v.number(),
    trips: v.array(scheduledTripSchema),
  },
  handler: async (
    ctx,
    args: { routeId: number; trips: ConvexScheduledTrip[] }
  ) => {
    // 0. Deduplicate input trips by Key (defensive programming)
    const uniqueTrips = Array.from(
      new Map(args.trips.map((trip) => [trip.Key, trip])).values()
    );

    try {
      // 1. Query existing trips for this route
      const existingTrips = await ctx.db
        .query("scheduledTrips")
        .withIndex("by_route", (q) => q.eq("RouteID", args.routeId))
        .collect();

      // 2. Build lookup maps for efficient diffing
      const existingByKey = new Map(
        existingTrips.map((trip) => [trip.Key, trip])
      );
      const newByKey = new Map(uniqueTrips.map((trip) => [trip.Key, trip]));

      // 3. Calculate changes needed
      const toDelete = existingTrips.filter((trip) => !newByKey.has(trip.Key));
      const toUpsert = uniqueTrips.filter((trip) => {
        const existing = existingByKey.get(trip.Key);
        // Insert if new, or update if changed
        return !existing || !tripsEqual(existing, trip);
      });

      // 4. Apply all changes atomically
      const results = {
        deleted: 0,
        inserted: 0,
        updated: 0,
      };

      // Delete cancelled trips
      for (const trip of toDelete) {
        await ctx.db.delete(trip._id);
        results.deleted++;
      }

      // Upsert changed/new trips
      for (const trip of toUpsert) {
        const existing = existingByKey.get(trip.Key);
        if (existing) {
          await ctx.db.replace(existing._id, trip);
          results.updated++;
        } else {
          await ctx.db.insert("scheduledTrips", trip);
          results.inserted++;
        }
      }

      return results;
    } catch (error) {
      throw new ConvexError({
        message: `Failed to sync scheduled trips for route ${args.routeId}`,
        code: "SYNC_SCHEDULED_TRIPS_FOR_ROUTE_FAILED",
        severity: "error",
        details: {
          routeId: args.routeId,
          inputTripCount: args.trips.length,
          deduplicatedTripCount: uniqueTrips.length,
          error: String(error),
        },
      });
    }
  },
});

/**
 * Bulk upsert scheduled trips (replace if exists, insert if not)
 * Uses composite key for deduplication
 * @deprecated Use syncScheduledTripsForRoute for atomic per-route operations
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
