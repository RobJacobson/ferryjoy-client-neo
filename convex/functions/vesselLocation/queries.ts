/**
 * Query handlers for current vessel location and backend vessel snapshots.
 */

import { internalQuery, query } from "_generated/server";
import { ConvexError, v } from "convex/values";
import { stripConvexMeta } from "../../shared/stripConvexMeta";
import { vesselSchema } from "../vessels/schemas";
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
    try {
      const vesselLocations = await ctx.db.query("vesselLocations").collect();
      return vesselLocations.map(stripConvexMeta);
    } catch (error) {
      throw new ConvexError({
        message: "Failed to fetch all vessel locations",
        code: "QUERY_FAILED",
        severity: "error",
        details: { error: String(error) },
      });
    }
  },
});

/**
 * Get the current vessel location for a specific vessel.
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
    try {
      const vesselLocation = await ctx.db
        .query("vesselLocations")
        .withIndex("by_vessel_abbrev", (q) =>
          q.eq("VesselAbbrev", args.vesselAbbrev)
        )
        .unique();

      return vesselLocation ? stripConvexMeta(vesselLocation) : null;
    } catch (error) {
      throw new ConvexError({
        message: `Failed to fetch vessel location for ${args.vesselAbbrev}`,
        code: "QUERY_FAILED",
        severity: "error",
        details: {
          vesselAbbrev: args.vesselAbbrev,
          error: String(error),
        },
      });
    }
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
  returns: v.array(vesselSchema),
  handler: async (ctx) => {
    const vessels = await ctx.db.query("vessels").collect();
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
  returns: v.union(v.array(vesselSchema), v.null()),
  handler: async (ctx) => {
    const vessels = await ctx.db.query("vessels").collect();

    if (vessels.length === 0) {
      return null;
    }

    return vessels.map(stripConvexMeta);
  },
});
