import { mutation } from "@convex/_generated/server";
import { ConvexError, v } from "convex/values";

import { activeVesselTripSchema, type ConvexActiveVesselTrip } from "./schemas";

/**
 * Insert a single active vessel trip
 */
export const insert = mutation({
  args: { trip: activeVesselTripSchema },
  handler: async (ctx, args: { trip: ConvexActiveVesselTrip }) => {
    try {
      await ctx.db.insert("activeVesselTrips", args.trip);
    } catch (error) {
      throw new ConvexError({
        message: `Failed to insert vessel trip for ${args.trip.VesselName}`,
        code: "INSERT_FAILED",
        severity: "error",
        details: { vesselId: args.trip.VesselID, error: String(error) },
      });
    }
  },
});

/**
 * Delete an active vessel trip by vessel ID
 */
export const deleteByVesselId = mutation({
  args: { vesselId: v.number() },
  handler: async (ctx, args) => {
    try {
      // Find all docs that match the VesselID
      const trips = await ctx.db
        .query("activeVesselTrips")
        .filter((q) => q.eq(q.field("VesselID"), args.vesselId))
        .collect();

      // Delete all docs that match the VesselID
      for (const trip of trips) {
        await ctx.db.delete(trip._id);
      }
    } catch (error) {
      throw new ConvexError({
        message: `Failed to delete vessel trips for vessel ID ${args.vesselId}`,
        code: "DELETE_FAILED",
        severity: "error",
        details: { vesselId: args.vesselId, error: String(error) },
      });
    }
  },
});

/**
 * Update an existing active vessel trip
 */
export const update = mutation({
  args: {
    trip: activeVesselTripSchema,
  },
  handler: async (ctx, args: { trip: ConvexActiveVesselTrip }) => {
    try {
      // Find the first doc that matches the VesselID
      const doc = await ctx.db
        .query("activeVesselTrips")
        .filter((q) => q.eq(q.field("VesselID"), args.trip.VesselID))
        .first();

      // If no doc is found, throw a ConvexError
      if (!doc) {
        throw new ConvexError({
          message: `No active trip found for vessel ${args.trip.VesselName}`,
          code: "TRIP_NOT_FOUND",
          severity: "warn",
          details: {
            vesselId: args.trip.VesselID,
            vesselName: args.trip.VesselName,
          },
        });
      }

      // Update the doc with Convex-shaped trip
      await ctx.db.replace(doc._id, args.trip);
    } catch (error) {
      if (error instanceof ConvexError) {
        throw error; // Re-throw ConvexError as-is
      }
      throw new ConvexError({
        message: `Failed to update vessel trip for ${args.trip.VesselName}`,
        code: "UPDATE_FAILED",
        severity: "error",
        details: { vesselId: args.trip.VesselID, error: String(error) },
      });
    }
  },
});
