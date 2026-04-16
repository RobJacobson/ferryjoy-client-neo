/**
 * Mutation handlers for vessel location snapshots and backend vessel mirrors.
 */

import type { Doc } from "_generated/dataModel";
import { internalMutation, mutation } from "_generated/server";
import { v } from "convex/values";
import { type Vessel, vesselSchema } from "../vessels/schemas";
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
 * @param ctx - Convex mutation context
 * @param args - Mutation arguments containing the location snapshot payload
 * @returns `undefined` after all required location upserts complete
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
 * Upsert the backend vessel snapshot with the latest upstream data.
 *
 * Existing rows are replaced in place when the VesselAbbrev matches, new rows
 * are inserted, and rows missing from the incoming snapshot are preserved.
 *
 * @param ctx - Convex internal mutation context
 * @param args - Mutation arguments containing backend vessel rows
 * @returns `undefined` after the backend vessel snapshot is replaced in place
 */
export const replaceBackendVessels = internalMutation({
  args: {
    vessels: v.array(vesselSchema),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query("vessels").collect();
    const { toInsert, toReplace } = buildBackendVesselUpsertOperations(
      existing,
      args.vessels
    );

    for (const { existing: existingVessel, incoming: vessel } of toReplace) {
      await ctx.db.replace(existingVessel._id, vessel);
    }

    for (const vessel of toInsert) {
      await ctx.db.insert("vessels", vessel);
    }
  },
});

/**
 * Build the abbreviation-keyed vessel upsert operations for one incoming snapshot.
 *
 * @param existing - Existing backend vessels
 * @param incoming - Incoming backend vessel snapshot
 * @returns Insert and replace operations without any delete step
 */
export const buildBackendVesselUpsertOperations = (
  existing: Array<Doc<"vessels">>,
  incoming: Array<Vessel>
) => {
  const existingByVesselAbbrev = new Map<string, Doc<"vessels">>(
    existing.map((vessel) => [vessel.VesselAbbrev, vessel])
  );
  const toInsert: Array<Vessel> = [];
  const toReplace: Array<{ existing: Doc<"vessels">; incoming: Vessel }> = [];

  for (const vessel of incoming) {
    const existingVessel = existingByVesselAbbrev.get(vessel.VesselAbbrev);

    if (existingVessel) {
      toReplace.push({ existing: existingVessel, incoming: vessel });
      continue;
    }

    toInsert.push(vessel);
  }

  return {
    toInsert,
    toReplace,
  };
};

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
