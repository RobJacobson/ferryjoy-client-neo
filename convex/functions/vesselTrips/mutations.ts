import { mutation } from "_generated/server";
import { ConvexError, v } from "convex/values";
import {
  type ConvexPrediction,
  type ConvexVesselTrip,
  vesselTripSchema,
} from "functions/vesselTrips/schemas";

const MS_PER_MINUTE = 60 * 1000;

/**
 * Calculate the range deviation delta for a prediction
 * Returns the difference between actual and the nearest prediction bound (min or max)
 *
 * @param actual - Actual timestamp in milliseconds
 * @param min - Minimum prediction bound in milliseconds
 * @param max - Maximum prediction bound in milliseconds
 * @returns Delta in minutes (positive if actual > max, negative if actual < min, 0 if within bounds)
 */
const calculateDeltaRange = (
  actual: number,
  min: number,
  max: number
): number => {
  if (actual < min)
    return Math.round(((actual - min) / MS_PER_MINUTE) * 10) / 10;
  if (actual > max)
    return Math.round(((actual - max) / MS_PER_MINUTE) * 10) / 10;
  return 0;
};

/**
 * Calculate the total prediction error delta
 *
 * @param actual - Actual timestamp in milliseconds
 * @param predicted - Predicted timestamp in milliseconds
 * @returns Delta in minutes (actual - predicted)
 */
const calculateDeltaTotal = (actual: number, predicted: number): number => {
  return Math.round(((actual - predicted) / MS_PER_MINUTE) * 10) / 10;
};

/**
 * Apply actual observed timestamp to a prediction, calculating deltas
 * @param prediction - The prediction to update with actual data
 * @param actualMs - The actual observed timestamp in milliseconds
 * @returns Updated prediction with actual timestamp and calculated deltas
 */
const applyActualToPrediction = (
  prediction: ConvexPrediction,
  actualMs: number
): ConvexPrediction => {
  const actual = Math.floor(actualMs / 1000) * 1000;
  return {
    ...prediction,
    Actual: actual,
    DeltaTotal: calculateDeltaTotal(actual, prediction.PredTime),
    DeltaRange: calculateDeltaRange(
      actual,
      prediction.MinTime,
      prediction.MaxTime
    ),
  };
};

/**
 * Upsert an active trip (update if exists, insert if not)
 * Only one active trip per vessel allowed
 *
 * @param ctx - Convex context
 * @param args.trip - The vessel trip to upsert
 * @returns The ID of the upserted trip document
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
 * @param ctx - Convex context
 * @param args.completedTrip - The completed vessel trip to archive
 * @param args.newTrip - The new vessel trip to start
 * @returns Object containing IDs of the completed and active trip documents
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

/**
 * Backfill depart-next prediction actuals onto the most recent completed trip.
 *
 * When the current active trip leaves dock at terminal B (B->C LeftDock becomes
 * known), that timestamp is the "actual depart-next" event for the previous
 * completed trip (A->B) at terminal B.
 * @param ctx - Convex context
 * @param args.vesselAbbrev - The vessel abbreviation to find completed trips for
 * @param args.actualDepartMs - The actual departure timestamp in milliseconds
 * @returns Object indicating if update was successful and containing updated trip data
 */
export const setDepartNextActualsForMostRecentCompletedTrip = mutation({
  args: {
    vesselAbbrev: v.string(),
    actualDepartMs: v.number(),
  },
  handler: async (ctx, args) => {
    const completedTrips = await ctx.db
      .query("completedVesselTrips")
      .withIndex("by_vessel_abbrev", (q) =>
        q.eq("VesselAbbrev", args.vesselAbbrev)
      )
      .collect();

    const tripsWithEnd = completedTrips.filter((t) => t.TripEnd !== undefined);
    tripsWithEnd.sort((a, b) => (b.TripEnd ?? 0) - (a.TripEnd ?? 0));
    const mostRecent = tripsWithEnd[0];
    if (!mostRecent) {
      return {
        updated: false as const,
        reason: "no_completed_trip" as const,
        updatedTrip: undefined,
      };
    }

    const updates: Partial<ConvexVesselTrip> = {};

    if (
      mostRecent.AtDockDepartNext &&
      mostRecent.AtDockDepartNext.Actual === undefined
    ) {
      updates.AtDockDepartNext = applyActualToPrediction(
        mostRecent.AtDockDepartNext,
        args.actualDepartMs
      );
    }

    if (
      mostRecent.AtSeaDepartNext &&
      mostRecent.AtSeaDepartNext.Actual === undefined
    ) {
      updates.AtSeaDepartNext = applyActualToPrediction(
        mostRecent.AtSeaDepartNext,
        args.actualDepartMs
      );
    }

    if (Object.keys(updates).length === 0) {
      return {
        updated: false as const,
        reason: "no_predictions_to_update" as const,
        updatedTrip: undefined,
      };
    }

    await ctx.db.patch(mostRecent._id, updates);

    // Return the updated trip so the action layer can insert predictions
    const updatedTrip = await ctx.db.get(mostRecent._id);
    return {
      updated: true as const,
      updatedTrip: updatedTrip ?? undefined,
    };
  },
});
