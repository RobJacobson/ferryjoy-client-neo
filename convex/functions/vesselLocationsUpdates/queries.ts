/**
 * Read queries for vessel-location update signatures.
 */

import { internalQuery } from "_generated/server";
import { v } from "convex/values";
import { stripConvexMeta } from "shared/stripConvexMeta";
import type { ConvexVesselLocationUpdate } from "./schemas";
import { vesselLocationUpdateValidationSchema } from "./schemas";

type UpdatesReadDb = {
  query: (table: "vesselLocationsUpdates") => {
    collect: () => Promise<
      Array<ConvexVesselLocationUpdate & Record<string, unknown>>
    >;
  };
};

/**
 * Read all update signatures as plain schema rows.
 */
export const readAllVesselLocationUpdates = async (
  db: UpdatesReadDb
): Promise<Array<ConvexVesselLocationUpdate>> => {
  const rows = await db.query("vesselLocationsUpdates").collect();
  return rows.map((row) => stripConvexMeta(row) as ConvexVesselLocationUpdate);
};

/**
 * Fetch all current update signatures for vessel-location dedupe.
 *
 * @param ctx - Convex internal query context
 * @returns Update signatures without Convex metadata
 */
export const getAllVesselUpdateTimeStampsInternal = internalQuery({
  args: {},
  returns: v.array(vesselLocationUpdateValidationSchema),
  handler: async (ctx) => readAllVesselLocationUpdates(ctx.db),
});
