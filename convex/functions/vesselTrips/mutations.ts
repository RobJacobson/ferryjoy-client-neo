import { ConvexError, v } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import { mutation } from "../../_generated/server";
import { type ConvexVesselTrip, vesselTripSchema } from "./schemas";

/**
 * Bulk upsert multiple vessel trips to activeVesselTrips table (update if exists, insert if not)
 */
export const bulkUpsertActiveTrips = mutation({
  args: { trips: v.array(vesselTripSchema) },
  handler: async (ctx, args: { trips: ConvexVesselTrip[] }) => {
    try {
      const results: {
        id: Id<"activeVesselTrips">;
        action: "updated" | "inserted";
        vesselId: number;
      }[] = [];

      // Process each trip in array
      for (const trip of args.trips) {
        // Find existing document by VesselID in activeVesselTrips table
        const existing = await ctx.db
          .query("activeVesselTrips")
          .filter((q) => q.eq(q.field("VesselID"), trip.VesselID))
          .first();

        if (existing) {
          // Update existing document
          await ctx.db.replace(existing._id, trip);
          results.push({
            id: existing._id,
            action: "updated",
            vesselId: trip.VesselID,
          });
        } else {
          // Insert new document
          const id = await ctx.db.insert("activeVesselTrips", trip);
          results.push({ id, action: "inserted", vesselId: trip.VesselID });
        }
      }

      return results;
    } catch (error) {
      throw new ConvexError({
        message: `Failed to bulk upsert vessel trips to activeVesselTrips`,
        code: "BULK_UPSERT_ACTIVE_FAILED",
        severity: "error",
        details: { error: String(error) },
      });
    }
  },
});

/**
 * Bulk insert multiple vessel trips to completedVesselTrips table (insert only)
 */
export const bulkInsertCompletedTrips = mutation({
  args: { trips: v.array(vesselTripSchema) },
  handler: async (ctx, args: { trips: ConvexVesselTrip[] }) => {
    try {
      const results: {
        id: Id<"completedVesselTrips">;
        vesselId: number;
      }[] = [];

      // Process each trip in array
      for (const trip of args.trips) {
        // Insert new document into completedVesselTrips table
        const id = await ctx.db.insert("completedVesselTrips", trip);
        results.push({ id, vesselId: trip.VesselID });
      }

      return results;
    } catch (error) {
      throw new ConvexError({
        message: `Failed to bulk insert vessel trips to completedVesselTrips`,
        code: "BULK_INSERT_COMPLETED_FAILED",
        severity: "error",
        details: { error: String(error) },
      });
    }
  },
});
