/**
 * Mutation handlers for vessel location snapshots and backend vessel mirrors.
 */

import type { MutationCtx } from "_generated/server";
import { internalMutation, mutation } from "_generated/server";
import { v } from "convex/values";
import { vesselIdentitySchema } from "../vessels/schemas";
import type { ConvexVesselLocation } from "./schemas";
import { vesselLocationValidationSchema } from "./schemas";

/**
 * Bulk upsert live `vesselLocations`: read current table, match by `VesselAbbrev`,
 * skip when `TimeStamp` is unchanged, otherwise replace or insert.
 *
 * Shared by {@link bulkUpsertVesselLocations} and orchestrator `persistOrchestratorPing`.
 *
 * @param ctx - Convex mutation context
 * @param locations - Normalized feed snapshot for this tick
 */
export async function performBulkUpsertVesselLocations(
  ctx: MutationCtx,
  locations: ReadonlyArray<ConvexVesselLocation>
): Promise<void> {
  const existingLocations = await ctx.db.query("vesselLocations").collect();
  const existingByAbbrev = new Map(
    existingLocations.map((loc) => [loc.VesselAbbrev, loc] as const)
  );

  for (const location of locations) {
    const existing = existingByAbbrev.get(location.VesselAbbrev);
    if (existing?.TimeStamp === location.TimeStamp) {
      continue;
    }

    if (existing) {
      await ctx.db.replace(existing._id, location);
    } else {
      await ctx.db.insert("vesselLocations", location);
    }
  }
}

/**
 * Public bulk upsert for normalized vessel location rows (full feed batch).
 *
 * Replaces the former `bulkUpsert` mutation; same args and semantics.
 *
 * @param ctx - Convex mutation context
 * @param args - Mutation arguments containing the location snapshot payload
 * @returns `null` after all required location upserts complete
 */
export const bulkUpsertVesselLocations = mutation({
  args: { locations: v.array(vesselLocationValidationSchema) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await performBulkUpsertVesselLocations(ctx, args.locations);
    return null;
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
