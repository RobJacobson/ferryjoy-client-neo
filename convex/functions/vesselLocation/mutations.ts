import type { Doc } from "_generated/dataModel";
import { mutation } from "_generated/server";
import { v } from "convex/values";

import {
  type ConvexVesselLocation,
  vesselLocationValidationSchema,
} from "./schemas";

/**
 * Bulk upsert vessel locations into the database
 * Replaces existing vessel locations that match by VesselID
 *
 * Only writes locations that are fresh (TimeStamp changed) or new vessels.
 * Skips stale locations where vessel + timestamp are unchanged.
 *
 * @param ctx - Convex context
 * @param args.locations - Array of vessel location records to upsert
 */
export const bulkUpsert = mutation({
  args: { locations: v.array(vesselLocationValidationSchema) },
  handler: async (ctx, args: { locations: ConvexVesselLocation[] }) => {
    const existingLocations = await ctx.db.query("vesselLocations").collect();

    const existingByVesselId = new Map(
      existingLocations.map((loc) => [loc.VesselID, loc])
    );

    const locationsNeedingWrite = args.locations.filter((location) =>
      shouldWriteLocation(location, existingByVesselId)
    );

    for (const location of locationsNeedingWrite) {
      const existing = existingByVesselId.get(location.VesselID);

      if (existing) {
        await ctx.db.replace(existing._id, location);
      } else {
        await ctx.db.insert("vesselLocations", location);
      }
    }
  },
});

/**
 * Returns true if location needs a database write.
 * New vessels always need insert; existing vessels need replace only when TimeStamp changed.
 *
 * @param location - Incoming vessel location from API
 * @param existingByVesselId - Map of existing locations by VesselID
 * @returns true if write is needed
 */
const shouldWriteLocation = (
  location: ConvexVesselLocation,
  existingByVesselId: Map<number, Doc<"vesselLocations">>
): boolean => {
  const existing = existingByVesselId.get(location.VesselID);
  return existing === undefined || existing.TimeStamp !== location.TimeStamp;
};
