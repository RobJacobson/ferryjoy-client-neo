/**
 * Mutation handlers for vessel location snapshots and backend vessel mirrors.
 */

import type { Id } from "_generated/dataModel";
import type { MutationCtx } from "_generated/server";
import { internalMutation, mutation } from "_generated/server";
import { v } from "convex/values";
import { vesselIdentitySchema } from "../vessels/schemas";
import type { ConvexVesselLocation } from "./schemas";
import { vesselLocationValidationSchema } from "./schemas";

type ChangedVesselLocationWrite = {
  vesselLocation: ConvexVesselLocation;
  existingLocationId?: Id<"vesselLocations">;
};

/**
 * Bulk upsert vessel locations into the database
 * Replaces existing vessel locations that match by VesselID
 *
 * Only writes locations that are fresh (TimeStamp changed) or new vessels.
 * Skips stale locations where vessel + timestamp are unchanged.
 *
 * @param ctx - Convex mutation context
 * @param args - Mutation arguments containing the location snapshot payload
 * @returns `null` after all required location upserts complete
 */
export const bulkUpsert = mutation({
  args: { locations: v.array(vesselLocationValidationSchema) },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get all existing vessel locations.
    const existingLocations = await ctx.db.query("vesselLocations").collect();

    // Build a map of existing vessel locations by vessel ID.
    const existingByVesselId = new Map(
      existingLocations.map((loc) => [loc.VesselID, loc] as const)
    );

    // Upsert each location that needs to be written.
    for (const location of args.locations) {
      const existing = existingByVesselId.get(location.VesselID);
      // Skip when this vessel already has the same snapshot (no DB change).
      if (existing?.TimeStamp === location.TimeStamp) {
        continue;
      }

      if (existing) {
        await ctx.db.replace(existing._id, location);
      } else {
        await ctx.db.insert("vesselLocations", location);
      }
    }

    return null;
  },
});

/**
 * Applies changed vessel-location rows without rereading the location table.
 *
 * @param ctx - Convex mutation context
 * @param changedLocations - Changed rows plus optional existing document ids
 * @returns `null` when all changed rows are persisted
 */
export const bulkUpsertChangedLocationsInDb = async (
  ctx: MutationCtx,
  changedLocations: ReadonlyArray<ChangedVesselLocationWrite>
): Promise<void> => {
  for (const { vesselLocation, existingLocationId } of changedLocations) {
    if (existingLocationId) {
      await ctx.db.replace(existingLocationId, vesselLocation);
      continue;
    }

    await ctx.db.insert("vesselLocations", vesselLocation);
  }
};

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
