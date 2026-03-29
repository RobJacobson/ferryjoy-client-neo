/**
 * Mutation handlers for active and completed vessel trips.
 *
 * Owns the write paths for active-trip upserts, trip completion rollover, and
 * depart-next prediction backfills on completed trips.
 */

import type { Id } from "_generated/dataModel";
import { mutation } from "_generated/server";
import { ConvexError, v } from "convex/values";
import { applyActualToPrediction } from "domain/ml/prediction";
import {
  type ConvexVesselTrip,
  vesselTripSchema,
} from "functions/vesselTrips/schemas";
import { stripConvexMeta } from "shared/stripConvexMeta";

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
      // Active trips are unique per vessel, so replace in place when present.
      const existing = await ctx.db
        .query("activeVesselTrips")
        .withIndex("by_vessel_abbrev", (q) =>
          q.eq("VesselAbbrev", args.trip.VesselAbbrev)
        )
        .first();

      if (existing) {
        await ctx.db.replace(existing._id, args.trip);
        return existing._id;
      }

      const id = await ctx.db.insert("activeVesselTrips", args.trip);
      return id;
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
 *
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
      // Completed trips must be finalized before they move to the archive table.
      if (!args.completedTrip.TripEnd) {
        throw new ConvexError({
          message: "Completed trip must have TripEnd set",
          code: "INVALID_COMPLETED_TRIP",
          severity: "error",
        });
      }

      // Replace the existing active row so the vessel keeps a stable active-trip id.
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

      const completedId = await ctx.db.insert(
        "completedVesselTrips",
        args.completedTrip
      );

      // Prediction writes stay in the action layer so this mutation stays atomic.
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
 * Upsert a vessel trip batch (best-effort per vessel).
 *
 * Handles only active trip upserts (insert/replace). Trip completions and
 * depart-next backfills are handled separately via inline mutations.
 *
 * Failures are isolated per vessel: the mutation does not throw for a single
 * vessel failure, and instead returns status entries.
 *
 * Note: Prediction record insertion is handled separately via a bulk predictions
 * mutation.
 *
 * @param ctx - Convex context
 * @param args.activeUpserts - Active trips to upsert (one per vessel)
 * @returns Status list per vessel
 */
export const upsertVesselTripsBatch = mutation({
  args: {
    activeUpserts: v.array(vesselTripSchema),
  },
  handler: async (ctx, args) => {
    // Load once so each vessel write can reuse the same lookup table.
    const activeTrips = await ctx.db.query("activeVesselTrips").collect();

    // Preserve inserts performed earlier in this batch for later iterations.
    const activeByVessel = new Map<string, { _id: Id<"activeVesselTrips"> }>(
      activeTrips.map((t) => [t.VesselAbbrev, { _id: t._id }])
    );

    const perVessel: Array<{
      vesselAbbrev: string;
      ok: boolean;
      reason?: string;
    }> = [];

    for (const trip of args.activeUpserts) {
      const vesselAbbrev = trip.VesselAbbrev;
      try {
        const existing = activeByVessel.get(vesselAbbrev);
        if (existing) {
          await ctx.db.replace(existing._id, trip);
        } else {
          const id = await ctx.db.insert("activeVesselTrips", trip);
          activeByVessel.set(vesselAbbrev, { _id: id });
        }
        perVessel.push({ vesselAbbrev, ok: true });
      } catch (error) {
        perVessel.push({
          vesselAbbrev,
          ok: false,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { perVessel };
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
  returns: v.object({
    updated: v.boolean(),
    reason: v.optional(v.string()),
    updatedTrip: v.optional(vesselTripSchema),
  }),
  handler: async (ctx, args) => {
    const mostRecent = await ctx.db
      .query("completedVesselTrips")
      .withIndex("by_vessel_and_trip_end", (q) =>
        q.eq("VesselAbbrev", args.vesselAbbrev)
      )
      .order("desc")
      .first();
    if (!mostRecent) {
      return {
        updated: false as const,
        reason: "no_completed_trip" as const,
        updatedTrip: undefined,
      };
    }

    const updates = computeDepartNextActualsPatch(
      mostRecent as unknown as ConvexVesselTrip,
      args.actualDepartMs
    );

    if (Object.keys(updates).length === 0) {
      return {
        updated: false as const,
        reason: "no_predictions_to_update" as const,
        updatedTrip: undefined,
      };
    }

    await ctx.db.patch(mostRecent._id, updates);

    const updatedTrip = await ctx.db.get(mostRecent._id);
    if (!updatedTrip) {
      return { updated: true as const, updatedTrip: undefined };
    }
    const tripData = stripConvexMeta(updatedTrip);
    return { updated: true as const, updatedTrip: tripData };
  },
});

/**
 * Compute patch to apply depart-next prediction actuals to a completed trip.
 *
 * When the current active trip leaves dock at terminal B (B->C LeftDock becomes
 * known), that timestamp is the "actual depart-next" event for the previous
 * completed trip (A->B) at terminal B.
 *
 * @param trip - Most recent completed trip for a vessel
 * @param actualDepartMs - Actual departure timestamp of the *next* trip (epoch ms)
 * @returns Partial trip patch (empty if no applicable predictions)
 */
function computeDepartNextActualsPatch(
  trip: ConvexVesselTrip,
  actualDepartMs: number
): Partial<ConvexVesselTrip> {
  const updates: Partial<ConvexVesselTrip> = {};

  if (trip.AtDockDepartNext && trip.AtDockDepartNext.Actual === undefined) {
    updates.AtDockDepartNext = applyActualToPrediction(
      trip.AtDockDepartNext,
      actualDepartMs
    );
  }

  if (trip.AtSeaDepartNext && trip.AtSeaDepartNext.Actual === undefined) {
    updates.AtSeaDepartNext = applyActualToPrediction(
      trip.AtSeaDepartNext,
      actualDepartMs
    );
  }

  return updates;
}
