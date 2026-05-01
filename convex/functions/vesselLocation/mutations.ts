/**
 * Mutation handlers for vessel location snapshots and backend vessel mirrors.
 */

import type { MutationCtx } from "_generated/server";
import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import { withAtDockObserved } from "domain/vesselOrchestration/updateVesselLocations";
import {
  type ConvexVesselTrip,
  vesselTripStoredSchema,
} from "functions/vesselTrips/schemas";
import { stripConvexMeta } from "shared/stripConvexMeta";
import { vesselIdentitySchema } from "../vessels/schemas";
import type {
  ConvexVesselLocation,
  ConvexVesselLocationIncoming,
} from "./schemas";
import {
  vesselLocationIncomingValidationSchema,
  vesselLocationValidationSchema,
} from "./schemas";

export type VesselLocationDedupeSummary = {
  totalIncoming: number;
  unchanged: number;
  replaced: number;
  inserted: number;
};

export type VesselLocationBulkUpsertResult = {
  changedLocations: ReadonlyArray<ConvexVesselLocation>;
  summary: VesselLocationDedupeSummary;
  /** Active trips for changed `VesselAbbrev` values, after location writes (orchestrator Stage 1). */
  activeTripsForChanged: ReadonlyArray<ConvexVesselTrip>;
};

/**
 * Bulk upsert live `vesselLocations`: single table read, attach `AtDockObserved`,
 * match by `VesselAbbrev`, skip when `TimeStamp` is unchanged, otherwise replace or insert.
 *
 * Shared by {@link bulkUpsertVesselLocations} and the orchestrator location
 * stage in `updateVesselOrchestrator`.
 *
 * @param ctx - Convex mutation context
 * @param locations - Normalized incoming rows for this tick (no `AtDockObserved`)
 */
export async function performBulkUpsertVesselLocations(
  ctx: MutationCtx,
  locations: ReadonlyArray<ConvexVesselLocationIncoming>
): Promise<VesselLocationBulkUpsertResult> {
  // Last row wins per vessel when the feed repeats an abbrev in one batch.
  const uniqueByAbbrev = new Map<string, ConvexVesselLocationIncoming>();
  for (const location of locations) {
    uniqueByAbbrev.set(location.VesselAbbrev, location);
  }
  const dedupedIncoming = [...uniqueByAbbrev.values()];
  const summary: VesselLocationDedupeSummary = {
    totalIncoming: dedupedIncoming.length,
    unchanged: 0,
    replaced: 0,
    inserted: 0,
  };

  const existingDocs = await ctx.db.query("vesselLocations").collect();
  const existingByAbbrev = new Map(
    existingDocs.map((loc) => [loc.VesselAbbrev, loc] as const)
  );
  const dedupedLocations = withAtDockObserved(dedupedIncoming);

  const changedLocations: Array<ConvexVesselLocation> = [];

  for (const location of dedupedLocations) {
    try {
      const existing = existingByAbbrev.get(location.VesselAbbrev);
      if (existing?.TimeStamp === location.TimeStamp) {
        summary.unchanged += 1;
        continue;
      }

      if (existing) {
        await ctx.db.replace(existing._id, location);
        changedLocations.push(location);
        summary.replaced += 1;
      } else {
        await ctx.db.insert("vesselLocations", location);
        changedLocations.push(location);
        summary.inserted += 1;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error(
        "[bulkUpsertVesselLocations] failed vessel location upsert",
        {
          vesselAbbrev: location.VesselAbbrev,
          vesselId: location.VesselID,
          timeStamp: location.TimeStamp,
          message: err.message,
          stack: err.stack,
        }
      );
    }
  }

  const activeTripsForChanged =
    changedLocations.length === 0
      ? []
      : await loadActiveTripsForChanged(ctx, changedLocations);

  return {
    changedLocations,
    summary,
    activeTripsForChanged,
  };
}

/**
 * Indexed reads of `activeVesselTrips` for distinct abbrevs in the changed set.
 * Runs in the same mutation as location upserts so trip rows match post-write state.
 */
async function loadActiveTripsForChanged(
  ctx: MutationCtx,
  changedLocations: ReadonlyArray<ConvexVesselLocation>
): Promise<Array<ConvexVesselTrip>> {
  const uniqueAbbrevs = [
    ...new Set(changedLocations.map((loc) => loc.VesselAbbrev)),
  ];
  const trips = await Promise.all(
    uniqueAbbrevs.map((abbrev) =>
      ctx.db
        .query("activeVesselTrips")
        .withIndex("by_vessel_abbrev", (q) => q.eq("VesselAbbrev", abbrev))
        .first()
    )
  );
  return trips
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .map(stripConvexMeta);
}

/**
 * Internal bulk upsert for normalized vessel location rows (full feed batch).
 *
 * Replaces the former `bulkUpsert` mutation; same args and semantics.
 *
 * @param ctx - Convex mutation context
 * @param args - Mutation arguments containing the location snapshot payload
 * @returns Changed location rows and active trips for those vessels (post-write)
 */
export const bulkUpsertVesselLocations = internalMutation({
  args: { locations: v.array(vesselLocationIncomingValidationSchema) },
  returns: v.object({
    changedLocations: v.array(vesselLocationValidationSchema),
    activeTripsForChanged: v.array(vesselTripStoredSchema),
  }),
  handler: async (ctx, args) => {
    const result = await performBulkUpsertVesselLocations(ctx, args.locations);
    return {
      changedLocations: [...result.changedLocations],
      activeTripsForChanged: [...result.activeTripsForChanged],
    };
  },
});

/**
 * Upsert the backend vessel snapshot with the latest upstream data.
 *
 * Existing rows are replaced in place when the VesselAbbrev matches, new rows
 * are inserted, and rows missing from the incoming snapshot are preserved.
 *
 * @param ctx - Convex internal mutation context
 * @param args - Mutation arguments containing backend vessel rows
 * @returns `null` after the backend vessel snapshot is updated
 */
export const replaceBackendVessels = internalMutation({
  args: {
    vessels: v.array(vesselIdentitySchema),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get all existing vessel identities.
    const existingRows = await ctx.db.query("vesselsIdentity").collect();

    // Build a map of existing vessel identities by abbreviation.
    const byAbbrev = new Map(
      existingRows.map((row) => [row.VesselAbbrev, row] as const)
    );

    // Upsert each vessel identity.
    for (const vessel of args.vessels) {
      const previous = byAbbrev.get(vessel.VesselAbbrev);
      if (previous) {
        await ctx.db.replace(previous._id, vessel);
      } else {
        await ctx.db.insert("vesselsIdentity", vessel);
      }
    }

    return null;
  },
});
