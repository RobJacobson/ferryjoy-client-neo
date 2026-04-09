/**
 * Mutation handlers for active and completed vessel trips.
 *
 * Owns the write paths for active-trip upserts, trip completion rollover, and
 * depart-next prediction actualization on `eventsPredicted`.
 */

import type { Id } from "_generated/dataModel";
import { mutation } from "_generated/server";
import { ConvexError, v } from "convex/values";
import { calculateDeltaTotal } from "domain/ml/prediction/vesselTripPredictions";
import { hydrateStoredTripsWithPredictions } from "functions/vesselTrips/hydrateTripPredictions";
import {
  type ConvexVesselTrip,
  vesselTripMlPayloadSchema,
  vesselTripSchema,
} from "functions/vesselTrips/schemas";
import { stripTripPredictionsForStorage } from "functions/vesselTrips/stripTripForStorage";
import { buildBoundaryKey } from "shared/keys";
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
  args: { trip: vesselTripMlPayloadSchema },
  handler: async (ctx, args) => {
    try {
      const stored = stripTripPredictionsForStorage(args.trip);
      const existing = await ctx.db
        .query("activeVesselTrips")
        .withIndex("by_vessel_abbrev", (q) =>
          q.eq("VesselAbbrev", stored.VesselAbbrev)
        )
        .first();

      if (existing) {
        await ctx.db.replace(existing._id, stored);
        return existing._id;
      }

      const id = await ctx.db.insert("activeVesselTrips", stored);
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
 * 2. Delete the previous active trip row
 * 3. Insert a fresh active trip row for the new trip
 *
 * @param ctx - Convex context
 * @param args.completedTrip - The completed vessel trip to archive
 * @param args.newTrip - The new vessel trip to start
 * @returns Object containing IDs of the completed and active trip documents
 */
export const completeAndStartNewTrip = mutation({
  args: {
    completedTrip: vesselTripMlPayloadSchema,
    newTrip: vesselTripMlPayloadSchema,
  },
  handler: async (ctx, args) => {
    try {
      if (!args.completedTrip.TripEnd) {
        throw new ConvexError({
          message: "Completed trip must have TripEnd set",
          code: "INVALID_COMPLETED_TRIP",
          severity: "error",
        });
      }

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

      const completedStored = stripTripPredictionsForStorage(
        args.completedTrip
      );
      const newStored = stripTripPredictionsForStorage(args.newTrip);

      const completedId = await ctx.db.insert(
        "completedVesselTrips",
        completedStored
      );

      await ctx.db.delete(existingActive._id);
      const activeTripId = await ctx.db.insert("activeVesselTrips", newStored);

      return {
        completedId,
        activeTripId,
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
 * @param ctx - Convex context
 * @param args.activeUpserts - Active trips to upsert (one per vessel)
 * @returns Status list per vessel
 */
export const upsertVesselTripsBatch = mutation({
  args: {
    activeUpserts: v.array(vesselTripMlPayloadSchema),
  },
  handler: async (ctx, args) => {
    // Load once so each vessel write can reuse the same lookup table.
    const activeTrips = await ctx.db.query("activeVesselTrips").collect();

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
        const stored = stripTripPredictionsForStorage(trip);
        const existing = activeByVessel.get(vesselAbbrev);
        if (existing) {
          await ctx.db.replace(existing._id, stored);
        } else {
          const id = await ctx.db.insert("activeVesselTrips", stored);
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
 * Backfill depart-next prediction actuals on `eventsPredicted` for the most
 * recent completed trip when the next leg leaves dock.
 *
 * @param ctx - Convex context
 * @param args.vesselAbbrev - The vessel abbreviation
 * @param args.actualDepartMs - Actual departure timestamp of the next trip (epoch ms)
 * @returns Whether any row was updated and optional hydrated completed trip
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

    const nextLegKey = mostRecent.NextKey;
    if (!nextLegKey || !mostRecent.SailingDay) {
      return {
        updated: false as const,
        reason: "no_next_leg_context" as const,
        updatedTrip: undefined,
      };
    }

    const depKey = buildBoundaryKey(nextLegKey, "dep-dock");
    const actualMs = Math.floor(args.actualDepartMs / 1000) * 1000;

    const types = ["AtDockDepartNext", "AtSeaDepartNext"] as const;
    let anyUpdated = false;

    for (const predictionType of types) {
      const existing = await ctx.db
        .query("eventsPredicted")
        .withIndex("by_key_type_and_source", (q) =>
          q
            .eq("Key", depKey)
            .eq("PredictionType", predictionType)
            .eq("PredictionSource", "ml")
        )
        .first();

      if (!existing || existing.Actual !== undefined) {
        continue;
      }

      await ctx.db.patch(existing._id, {
        Actual: actualMs,
        DeltaTotal: calculateDeltaTotal(actualMs, existing.EventPredictedTime),
      });
      anyUpdated = true;
    }

    if (!anyUpdated) {
      return {
        updated: false as const,
        reason: "no_predictions_to_update" as const,
        updatedTrip: undefined,
      };
    }

    const hydrated = await hydrateStoredTripsWithPredictions(ctx, [mostRecent]);
    const tripData = stripConvexMeta(hydrated[0]) as ConvexVesselTrip;
    return {
      updated: true as const,
      updatedTrip: tripData,
    };
  },
});
