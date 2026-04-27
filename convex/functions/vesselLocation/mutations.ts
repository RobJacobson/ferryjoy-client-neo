/**
 * Mutation handlers for vessel location snapshots and backend vessel mirrors.
 */

import type { MutationCtx } from "_generated/server";
import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import { withAtDockObserved } from "domain/vesselOrchestration/updateVesselLocations";
import { stripConvexMeta } from "../../shared/stripConvexMeta";
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
  const existingForObserved = existingDocs.map(stripConvexMeta);
  const dedupedLocations = withAtDockObserved(
    existingForObserved,
    dedupedIncoming
  );

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

  return {
    changedLocations,
    summary,
  };
}

/**
 * Internal bulk upsert for normalized vessel location rows (full feed batch).
 *
 * Replaces the former `bulkUpsert` mutation; same args and semantics.
 *
 * @param ctx - Convex mutation context
 * @param args - Mutation arguments containing the location snapshot payload
 * @returns Rows that were inserted/replaced after timestamp dedupe
 */
export const bulkUpsertVesselLocations = internalMutation({
  args: { locations: v.array(vesselLocationIncomingValidationSchema) },
  returns: v.array(vesselLocationValidationSchema),
  handler: async (ctx, args) => {
    const result = await performBulkUpsertVesselLocations(ctx, args.locations);
    return [...result.changedLocations];
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
