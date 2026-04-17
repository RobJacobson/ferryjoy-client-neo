/**
 * Query handlers for current vessel location and backend vessel snapshots.
 */

import { internalQuery, query } from "_generated/server";
import { v } from "convex/values";
import { stripConvexMeta } from "../../shared/stripConvexMeta";
import { vesselIdentitySchema } from "../vesselIdentities/schemas";
import { vesselLocationValidationSchema } from "./schemas";

/**
 * Get all vessel locations from the database
 *
 * @param ctx - Convex query context
 * @returns Array of all vessel location records without metadata
 */
export const getAll = query({
  args: {},
  returns: v.array(vesselLocationValidationSchema),
  handler: async (ctx) => {
    const vesselLocations = await ctx.db.query("vesselLocations").collect();
    return vesselLocations.map(stripConvexMeta);
  },
});

/**
 * Get the current vessel location for a specific vessel.
 *
 * Returns `null` when no row exists for the abbreviation. If more than one row
 * matches (unexpected for this index), Convex `unique()` throws so the bug
 * surfaces instead of being swallowed.
 *
 * @param ctx - Convex query context
 * @param args - Query arguments containing the vessel abbreviation
 * @returns Vessel location record without metadata, or null if unavailable
 */
export const getByVesselAbbrev = query({
  args: {
    vesselAbbrev: v.string(),
  },
  returns: v.union(vesselLocationValidationSchema, v.null()),
  handler: async (ctx, args) => {
    const vesselLocation = await ctx.db
      .query("vesselLocations")
      .withIndex("by_vessel_abbrev", (q) =>
        q.eq("VesselAbbrev", args.vesselAbbrev)
      )
      .unique();

    return vesselLocation ? stripConvexMeta(vesselLocation) : null;
  },
});

/**
 * Fetch all backend vessel rows.
 *
 * @param ctx - Convex internal query context
 * @returns Backend vessel rows without Convex metadata
 */
export const getAllBackendVesselsInternal = internalQuery({
  args: {},
  returns: v.array(vesselIdentitySchema),
  handler: async (ctx) => {
    const vessels = await ctx.db.query("vesselsIdentity").collect();
    return vessels.map(stripConvexMeta);
  },
});

/**
 * Public frontend snapshot query for canonical vessel identity data.
 *
 * @param ctx - Convex public query context
 * @returns Vessel snapshot rows without Convex metadata, or `null` when empty
 */
export const getFrontendVesselsSnapshot = query({
  args: {},
  returns: v.union(v.array(vesselIdentitySchema), v.null()),
  handler: async (ctx) => {
    const vessels = await ctx.db.query("vesselsIdentity").collect();

    if (vessels.length === 0) {
      return null;
    }

    return vessels.map(stripConvexMeta);
  },
});
