import type { Doc } from "_generated/dataModel";
import { internalMutation, mutation } from "_generated/server";
import { v } from "convex/values";

import {
  type ConvexVesselLocation,
  vesselLocationValidationSchema,
} from "./schemas";
import { vesselSchema } from "../vessels/schemas";

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
 * Replace the canonical vessel snapshot with the latest upstream data.
 *
 * Existing rows are replaced in place when the VesselID matches, new rows are
 * inserted, and rows missing from the incoming snapshot are deleted.
 *
 * @param ctx - Convex internal mutation context
 * @param args.vessels - Full canonical vessel snapshot from WSF basics
 * @returns Summary of rows inserted, replaced, and deleted
 */
export const replaceCanonicalVessels = internalMutation({
  args: {
    vessels: v.array(vesselSchema),
  },
  returns: v.object({
    inserted: v.number(),
    replaced: v.number(),
    deleted: v.number(),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("vessels").collect();
    const existingByVesselId = new Map<number, Doc<"vessels">>(
      existing.map((vessel) => [vessel.VesselID, vessel])
    );
    const incomingVesselIds = new Set<number>();

    let inserted = 0;
    let replaced = 0;

    for (const vessel of args.vessels) {
      incomingVesselIds.add(vessel.VesselID);

      const existingVessel = existingByVesselId.get(vessel.VesselID);

      if (existingVessel) {
        await ctx.db.replace(existingVessel._id, vessel);
        replaced += 1;
        continue;
      }

      await ctx.db.insert("vessels", vessel);
      inserted += 1;
    }

    let deleted = 0;

    for (const existingVessel of existing) {
      if (incomingVesselIds.has(existingVessel.VesselID)) {
        continue;
      }

      await ctx.db.delete(existingVessel._id);
      deleted += 1;
    }

    return {
      inserted,
      replaced,
      deleted,
    };
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
