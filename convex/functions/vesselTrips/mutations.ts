/**
 * Mutation handlers for active and completed vessel trips.
 *
 * Owns the write paths for active-trip upserts, trip completion rollover, and
 * depart-next prediction actualization on `eventsPredicted`.
 */

import type { Id } from "_generated/dataModel";
import type { MutationCtx } from "_generated/server";
import { internalMutation } from "_generated/server";
import { ConvexError, v } from "convex/values";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { vesselTripStoredSchema } from "functions/vesselTrips/schemas";

/**
 * Archives one active leg to `completedVesselTrips` and persists the next active row.
 *
 * Wraps `rolloverCompletedAndActiveInDb` with `ConvexError` translation for API
 * stability on failure.
 *
 * @param ctx - Convex internal mutation context
 * @param args.completedTrip - The completed vessel trip to archive
 * @param args.newTrip - The new vessel trip to start
 * @returns `null` on success
 */
export const completeAndStartNewTrip = internalMutation({
  args: {
    completedTrip: vesselTripStoredSchema,
    newTrip: vesselTripStoredSchema,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      await rolloverCompletedAndActiveInDb(
        ctx,
        args.completedTrip,
        args.newTrip
      );
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
 * Best-effort batch upsert of active trips (internal mutation entry).
 *
 * Delegates to `upsertVesselTripsBatchInDb` so each vessel failure is captured
 * in `perVessel` without aborting siblings.
 *
 * @param ctx - Convex internal mutation context
 * @param args.activeUpserts - Active trips to upsert (typically one per vessel)
 * @returns Status list per vessel
 */
export const upsertVesselTripsBatch = internalMutation({
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
  handler: async (ctx, args) =>
    upsertVesselTripsBatchInDb(ctx, args.activeUpserts),
});

/**
 * Inserts one completed trip row (internal mutation wrapper).
 *
 * Validates `TripEnd` via `insertCompletedVesselTrip` before insert.
 *
 * @param ctx - Convex mutation context
 * @param args.completedTrip - Completed trip row for archival table
 * @returns `null` after insert
 */
export const insertCompletedVesselTripRow = internalMutation({
  args: {
    completedTrip: vesselTripStoredSchema,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await insertCompletedVesselTrip(ctx, args.completedTrip);
    return null;
  },
});

/**
 * Upserts one active trip row keyed by `VesselAbbrev` (internal mutation wrapper).
 *
 * Delegates to `upsertActiveVesselTrip` for replace-or-insert semantics.
 *
 * @param ctx - Convex mutation context
 * @param args.activeTrip - Active trip row for replacement/insert
 * @returns `null` after upsert
 */
export const upsertActiveVesselTripRow = internalMutation({
  args: {
    activeTrip: vesselTripStoredSchema,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await upsertActiveVesselTrip(ctx, args.activeTrip);
    return null;
  },
});

/**
 * Best-effort upsert of many active trips in one mutation helper.
 *
 * Preloads all active rows into a vessel→id map, then replaces or inserts per
 * upsert while catching errors per vessel for batch reporting.
 *
 * @param ctx - Convex mutation context
 * @param activeUpserts - Candidate active rows (typically one per vessel)
 * @returns Per-vessel ok flag and optional error message
 */
export const upsertVesselTripsBatchInDb = async (
  ctx: MutationCtx,
  activeUpserts: ConvexVesselTrip[]
): Promise<{
  perVessel: Array<{
    vesselAbbrev: string;
    ok: boolean;
    reason?: string;
  }>;
}> => {
  const activeTrips = await ctx.db.query("activeVesselTrips").collect();
  const activeByVessel = new Map<string, { _id: Id<"activeVesselTrips"> }>(
    activeTrips.map((trip) => [trip.VesselAbbrev, { _id: trip._id }])
  );

  const perVessel: Array<{
    vesselAbbrev: string;
    ok: boolean;
    reason?: string;
  }> = [];

  for (const trip of activeUpserts) {
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
};

/**
 * Inserts one row into `completedVesselTrips` after validation.
 *
 * Requires `TripEnd` so archived legs always have coverage end metadata.
 *
 * @param ctx - Mutation context
 * @param completedTrip - Completed trip document to archive
 * @returns Resolves when the insert completes
 */
export const insertCompletedVesselTrip = async (
  ctx: MutationCtx,
  completedTrip: ConvexVesselTrip
): Promise<void> => {
  assertCompletedTripHasEndTime(completedTrip);
  await ctx.db.insert("completedVesselTrips", completedTrip);
};

/**
 * Upserts one row in `activeVesselTrips` by `VesselAbbrev`.
 *
 * Replaces the first matching row when present; otherwise inserts a new active leg.
 *
 * @param ctx - Mutation context
 * @param trip - Active trip row to persist
 * @returns Resolves when replace or insert completes
 */
export const upsertActiveVesselTrip = async (
  ctx: MutationCtx,
  trip: ConvexVesselTrip
): Promise<void> => {
  const existing = await ctx.db
    .query("activeVesselTrips")
    .withIndex("by_vessel_abbrev", (q) =>
      q.eq("VesselAbbrev", trip.VesselAbbrev)
    )
    .first();

  if (existing !== null) {
    await ctx.db.replace(existing._id, trip);
    return;
  }

  await ctx.db.insert("activeVesselTrips", trip);
};

/**
 * Archives the completed leg and persists the next active row for that vessel.
 *
 * Sequential insert-then-upsert so the completed row exists before the active row
 * is replaced for the same vessel key.
 *
 * @param ctx - Mutation context
 * @param completedTrip - Leg moving to `completedVesselTrips`
 * @param activeTrip - Replacement active row for that vessel
 * @returns Resolves when both writes complete
 */
export const rolloverCompletedAndActiveInDb = async (
  ctx: MutationCtx,
  completedTrip: ConvexVesselTrip,
  activeTrip: ConvexVesselTrip
): Promise<void> => {
  await insertCompletedVesselTrip(ctx, completedTrip);
  await upsertActiveVesselTrip(ctx, activeTrip);
};

/**
 * Replaces or inserts one active trip using a preloaded id map.
 *
 * Updates `activeByVessel` after insert so subsequent rows in the same batch see
 * fresh ids without re-querying the table.
 *
 * @param ctx - Mutation context
 * @param stored - Trip fields without embedded ML blobs
 * @param vesselAbbrev - Vessel key (must match `stored.VesselAbbrev`)
 * @param activeByVessel - Live map of vessel → active row id; updated on insert
 * @returns Resolves when the write completes
 */
const replaceOrInsertActiveTripForVessel = async (
  ctx: MutationCtx,
  stored: ConvexVesselTrip,
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
 * Asserts a completed trip row has `TripEnd` before archival.
 *
 * Throws `ConvexError` with `INVALID_COMPLETED_TRIP` when the end timestamp is
 * absent so bad data never reaches `completedVesselTrips`.
 *
 * @param completedTrip - Candidate completed trip row
 * @returns `undefined` when valid; never returns when invalid
 */
const assertCompletedTripHasEndTime = (
  completedTrip: ConvexVesselTrip
): void => {
  if (completedTrip.TripEnd) {
    return;
  }

  throw new ConvexError({
    message: "Completed trip must have TripEnd set",
    code: "INVALID_COMPLETED_TRIP",
    severity: "error",
  });
};
