/**
 * Internal mutations for vessel-location update signatures.
 */

import type { Id } from "_generated/dataModel";
import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import { vesselLocationValidationSchema } from "functions/vesselLocation/schemas";
import type { ConvexVesselLocationUpdate } from "./schemas";

/**
 * Upsert changed vessel locations and their update signatures in one mutation.
 *
 * @param ctx - Convex mutation context
 * @param args.locations - Changed vessel-location rows for this ping
 * @returns `null` once all upserts are applied
 */
export const bulkUpsertLocationsAndUpdates = internalMutation({
  args: {
    locations: v.array(vesselLocationValidationSchema),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.locations.length === 0) {
      return null;
    }

    const existingUpdates = await ctx.db.query("vesselLocationsUpdates").collect();
    const existingUpdatesByAbbrev = new Map<
      string,
      ConvexVesselLocationUpdate & { _id: Id<"vesselLocationsUpdates"> }
    >(existingUpdates.map((row) => [row.VesselAbbrev, row]));

    for (const location of args.locations) {
      const previousUpdate = existingUpdatesByAbbrev.get(location.VesselAbbrev);
      const previousLocationId = previousUpdate?.VesselLocationId;
      let vesselLocationId = previousLocationId;

      if (
        typeof previousLocationId === "string" &&
        previousLocationId.length > 0
      ) {
        await ctx.db.replace(previousLocationId, location);
      } else {
        // Cold-start recovery: if updates table is empty/stale, reuse existing
        // live row by vessel abbrev instead of inserting a duplicate.
        const existingLocation = await ctx.db
          .query("vesselLocations")
          .withIndex("by_vessel_abbrev", (q) =>
            q.eq("VesselAbbrev", location.VesselAbbrev)
          )
          .unique();
        if (existingLocation) {
          await ctx.db.replace(existingLocation._id, location);
          vesselLocationId = existingLocation._id;
        } else {
          vesselLocationId = await ctx.db.insert("vesselLocations", location);
        }
      }

      const updateRow: ConvexVesselLocationUpdate = {
        VesselAbbrev: location.VesselAbbrev,
        TimeStamp: location.TimeStamp,
        VesselLocationId: vesselLocationId as Id<"vesselLocations"> | undefined,
      };

      if (previousUpdate) {
        await ctx.db.replace(previousUpdate._id, updateRow);
      } else {
        await ctx.db.insert("vesselLocationsUpdates", updateRow);
      }
    }

    return null;
  },
});
