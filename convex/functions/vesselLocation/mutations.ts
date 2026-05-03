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
 * Bulk upserts live `vesselLocations` from one normalized feed batch.
 *
 * One table read, `withAtDockObserved` enrichment, dedupe by `VesselAbbrev`,
 * skip unchanged `TimeStamp`, then load `activeVesselTrips` for changed abbrevs
 * in the same mutation. Shared by `bulkUpsertVesselLocations` and the
 * orchestrator location stage in `updateVesselOrchestrator`.
 *
 * @param ctx - Convex mutation context
 * @param locations - Normalized incoming rows for this tick (no `AtDockObserved`)
 * @returns Changed locations, dedupe counts, and active trips after writes for
 *   changed vessels (orchestrator Stage 2 contract in `VesselOrchestratorPipeline.md`)
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
 * Loads `activeVesselTrips` rows for distinct vessel abbrevs that changed.
 *
 * Runs in the same mutation as location writes so `existingVesselTrip` reflects
 * post-upsert DB state for the orchestrator per-vessel loop.
 *
 * @param ctx - Convex mutation context
 * @param changedLocations - Locations that were inserted or replaced this tick
 * @returns Active trip docs for those vessels (metadata stripped), may be sparse
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
 * Convex `internalMutation` wrapper for `performBulkUpsertVesselLocations`.
 *
 * Validates args with Convex validators and returns arrays suitable for action
 * wiring; replaces the legacy `bulkUpsert` entrypoint without changing semantics.
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
 * Reconciles `vesselsIdentity` from one upstream vessel identity snapshot.
 *
 * Replaces or inserts per `VesselAbbrev`; rows missing from the batch are kept
 * so partial fetches never delete vessels absent from that payload.
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
    const existingRows = await ctx.db.query("vesselsIdentity").collect();

    const byAbbrev = new Map(
      existingRows.map((row) => [row.VesselAbbrev, row] as const)
    );

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
