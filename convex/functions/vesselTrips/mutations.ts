/**
 * Mutation handlers for active and completed vessel trips.
 *
 * Owns the write paths for active-trip upserts, trip completion rollover, and
 * depart-next prediction actualization on `eventsPredicted`.
 */

import type { Id } from "_generated/dataModel";
import type { MutationCtx } from "_generated/server";
import { mutation } from "_generated/server";
import { ConvexError, v } from "convex/values";
import {
  DEPART_NEXT_ML_PREDICTION_TYPES,
  resolveDepartNextLegContext,
} from "domain/vesselTrips/mutations/departNextActualization";
import type { ConvexVesselTripStored } from "functions/vesselTrips/schemas";
import { vesselTripStoredSchema } from "functions/vesselTrips/schemas";
import { getRoundedMinutesDelta } from "shared/time";

/**
 * Complete an active trip and start a new one.
 * Performs three steps in one mutation transaction:
 * 1. Insert the completed trip into completedVesselTrips
 * 2. Delete the previous active trip row
 * 3. Insert a fresh active trip row for the new trip
 *
 * @param ctx - Convex context
 * @param args.completedTrip - The completed vessel trip to archive
 * @param args.newTrip - The new vessel trip to start
 * @returns Null on success
 */
export const completeAndStartNewTrip = mutation({
  args: {
    completedTrip: vesselTripStoredSchema,
    newTrip: vesselTripStoredSchema,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      assertCompletedTripHasEndTime(args.completedTrip);
      const existingActive = await getExistingActiveTripOrThrow(
        ctx,
        args.completedTrip.VesselAbbrev
      );

      await ctx.db.insert("completedVesselTrips", args.completedTrip);

      await ctx.db.delete(existingActive._id);

      await ctx.db.insert("activeVesselTrips", args.newTrip);

      return null;
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
    activeUpserts: v.array(vesselTripStoredSchema),
  },
  returns: v.object({
    perVessel: v.array(
      v.object({
        vesselAbbrev: v.string(),
        ok: v.boolean(),
        reason: v.optional(v.string()),
      })
    ),
  }),
  handler: async (ctx, args) => {
    const activeTrips = await ctx.db.query("activeVesselTrips").collect();
    const activeByVessel = new Map<string, { _id: Id<"activeVesselTrips"> }>(
      activeTrips.map((trip) => [trip.VesselAbbrev, { _id: trip._id }])
    );

    const perVessel: Array<{
      vesselAbbrev: string;
      ok: boolean;
      reason?: string;
    }> = [];

    for (const trip of args.activeUpserts) {
      const vesselAbbrev = trip.VesselAbbrev;
      try {
        await replaceOrInsertActiveTripForVessel(
          ctx,
          trip,
          vesselAbbrev,
          activeByVessel
        );
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
 * @returns Whether any prediction row was patched and optional skip reason
 */
export const setDepartNextActualsForMostRecentCompletedTrip = mutation({
  args: {
    vesselAbbrev: v.string(),
    actualDepartMs: v.number(),
  },
  returns: v.object({
    updated: v.boolean(),
    reason: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const mostRecent = await getMostRecentCompletedTrip(ctx, args.vesselAbbrev);
    if (!mostRecent) {
      return {
        updated: false as const,
        reason: "no_completed_trip" as const,
      };
    }

    const leg = resolveDepartNextLegContext(mostRecent, args.actualDepartMs);
    if (!leg.ok) {
      return {
        updated: false as const,
        reason: leg.reason,
      };
    }

    const { depKey, actualMs } = leg;
    const anyUpdated = await patchDepartNextPredictionActuals(
      ctx,
      depKey,
      actualMs
    );

    if (!anyUpdated) {
      return {
        updated: false as const,
        reason: "no_predictions_to_update" as const,
      };
    }

    return {
      updated: true as const,
    };
  },
});

/**
 * Persists one stripped active trip row, replacing when the vessel already has a row.
 *
 * @param ctx - Mutation context
 * @param stored - Trip fields without embedded ML blobs
 * @param vesselAbbrev - Vessel key (must match stored.VesselAbbrev)
 * @param activeByVessel - Live map of vessel → active row id; updated on insert
 */
const replaceOrInsertActiveTripForVessel = async (
  ctx: MutationCtx,
  stored: ConvexVesselTripStored,
  vesselAbbrev: string,
  activeByVessel: Map<string, { _id: Id<"activeVesselTrips"> }>
): Promise<void> => {
  const existing = activeByVessel.get(vesselAbbrev);
  if (existing) {
    await ctx.db.replace(existing._id, stored);
    return;
  }
  const id = await ctx.db.insert("activeVesselTrips", stored);
  activeByVessel.set(vesselAbbrev, { _id: id });
};

/**
 * Ensure completed trips carry a coverage end before archival.
 *
 * @param completedTrip - Candidate completed trip row
 * @returns Nothing; throws when `EndTime` is missing
 */
const assertCompletedTripHasEndTime = (
  completedTrip: ConvexVesselTripStored
): void => {
  if (completedTrip.EndTime) {
    return;
  }

  throw new ConvexError({
    message: "Completed trip must have EndTime set",
    code: "INVALID_COMPLETED_TRIP",
    severity: "error",
  });
};

/**
 * Load the current active row for one vessel or throw a structured error.
 *
 * @param ctx - Mutation context
 * @param vesselAbbrev - Vessel abbreviation
 * @returns Existing active trip row
 */
const getExistingActiveTripOrThrow = async (
  ctx: MutationCtx,
  vesselAbbrev: string
) => {
  const existingActive = await ctx.db
    .query("activeVesselTrips")
    .withIndex("by_vessel_abbrev", (q) => q.eq("VesselAbbrev", vesselAbbrev))
    .first();

  if (existingActive) {
    return existingActive;
  }

  throw new ConvexError({
    message: `No active trip found for vessel ${vesselAbbrev}`,
    code: "ACTIVE_TRIP_NOT_FOUND",
    severity: "error",
    details: { vesselAbbrev },
  });
};

/**
 * Load the latest completed trip for one vessel.
 *
 * @param ctx - Mutation context
 * @param vesselAbbrev - Vessel abbreviation
 * @returns Most recent completed trip or null
 */
const getMostRecentCompletedTrip = (ctx: MutationCtx, vesselAbbrev: string) =>
  ctx.db
    .query("completedVesselTrips")
    .withIndex("by_vessel_and_trip_end", (q) =>
      q.eq("VesselAbbrev", vesselAbbrev)
    )
    .order("desc")
    .first();

/**
 * Patch depart-next ML predictions for one departure boundary when rows exist.
 *
 * @param ctx - Mutation context
 * @param depKey - Departure boundary key
 * @param actualMs - Observed departure timestamp
 * @returns True when at least one prediction row was updated
 */
const patchDepartNextPredictionActuals = async (
  ctx: MutationCtx,
  depKey: string,
  actualMs: number
): Promise<boolean> => {
  let anyUpdated = false;

  for (const predictionType of DEPART_NEXT_ML_PREDICTION_TYPES) {
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
      DeltaTotal: getRoundedMinutesDelta(existing.EventPredictedTime, actualMs),
    });
    anyUpdated = true;
  }

  return anyUpdated;
};
