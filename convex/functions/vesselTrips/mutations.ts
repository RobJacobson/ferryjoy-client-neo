import { mutation } from "_generated/server";
import { ConvexError } from "convex/values";
import {
  type ConvexVesselTrip,
  vesselTripSchema,
} from "functions/vesselTrips/schemas";

/**
 * Upsert an active trip (update if exists, insert if not)
 * Only one active trip per vessel allowed
 */
export const upsertActiveTrip = mutation({
  args: { trip: vesselTripSchema },
  handler: async (ctx, args: { trip: ConvexVesselTrip }) => {
    try {
      const existing = await ctx.db
        .query("activeVesselTrips")
        .withIndex("by_vessel_abbrev", (q) =>
          q.eq("VesselAbbrev", args.trip.VesselAbbrev)
        )
        .first();

      if (existing) {
        // Update existing trip
        await ctx.db.replace(existing._id, args.trip);
        return existing._id;
      } else {
        // Insert new trip
        const id = await ctx.db.insert("activeVesselTrips", args.trip);
        return id;
      }
    } catch (error) {
      throw new ConvexError({
        message: `Failed to upsert active trip for vessel ${args.trip.VesselAbbrev}`,
        code: "UPSERT_ACTIVE_TRIP_FAILED",
        severity: "error",
        details: {
          vesselAbbrev: args.trip.VesselAbbrev,
          error: String(error),
        },
      });
    }
  },
});

/**
 * Complete an active trip and start a new one
 * Performs two atomic operations:
 * 1. Insert the completed trip into completedVesselTrips
 * 2. Overwrite the active trip with new trip data
 *
 * Note: ML predictions are calculated in the action layer after trip creation
 * if both departing and arriving terminals are non-null
 */
export const completeAndStartNewTrip = mutation({
  args: {
    completedTrip: vesselTripSchema,
    newTrip: vesselTripSchema,
  },
  handler: async (
    ctx,
    args: { completedTrip: ConvexVesselTrip; newTrip: ConvexVesselTrip }
  ) => {
    try {
      // Verify completed trip has TripEnd set
      if (!args.completedTrip.TripEnd) {
        throw new ConvexError({
          message: "Completed trip must have TripEnd set",
          code: "INVALID_COMPLETED_TRIP",
          severity: "error",
        });
      }

      // Get the existing active trip to overwrite
      const existingActive = await ctx.db
        .query("activeVesselTrips")
        .withIndex("by_vessel_abbrev", (q) =>
          q.eq("VesselAbbrev", args.completedTrip.VesselAbbrev)
        )
        .first();

      if (!existingActive) {
        throw new ConvexError({
          message: `No active trip found for vessel ${args.completedTrip.VesselAbbrev}`,
          code: "ACTIVE_TRIP_NOT_FOUND",
          severity: "error",
          details: { vesselAbbrev: args.completedTrip.VesselAbbrev },
        });
      }

      // 1. Insert completed trip
      const completedId = await ctx.db.insert(
        "completedVesselTrips",
        args.completedTrip
      );

      // 2. Overwrite the active trip with new trip data
      // Note: ML predictions are calculated in the action layer when the arriving
      // terminal first becomes available
      await ctx.db.replace(existingActive._id, args.newTrip);

      return {
        completedId,
        activeTripId: existingActive._id,
      };
    } catch (error) {
      if (error instanceof ConvexError) {
        throw error;
      }
      throw new ConvexError({
        message: `Failed to complete and start new trip for vessel ${args.completedTrip.VesselAbbrev}`,
        code: "COMPLETE_AND_START_TRIP_FAILED",
        severity: "error",
        details: {
          vesselAbbrev: args.completedTrip.VesselAbbrev,
          error: String(error),
        },
      });
    }
  },
});
