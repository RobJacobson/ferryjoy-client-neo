import { internalQuery, query } from "_generated/server";
import { ConvexError, v } from "convex/values";
import { stripConvexMeta } from "../../shared/stripConvexMeta";
import { resolveVessel, type VesselSelector } from "../../shared/vessels";
import { vesselSchema } from "../vessels/schemas";
import { vesselLocationValidationSchema } from "./schemas";

const vesselSelectorSchema = v.union(
  v.object({
    VesselAbbrev: v.string(),
  }),
  v.object({
    VesselID: v.number(),
  }),
  v.object({
    VesselName: v.string(),
  })
);

/**
 * Get all vessel locations from the database
 *
 * @param ctx - Convex context
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
 * @param ctx - Convex context
 * @param args.vesselAbbrev - Vessel abbreviation to fetch
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
 * Fetch all canonical vessels.
 *
 * @param ctx - Convex internal query context
 * @returns Canonical vessels without Convex metadata
 */
export const getAllCanonicalVesselsInternal = internalQuery({
  args: {},
  returns: v.array(vesselSchema),
  handler: async (ctx) => {
    const vessels = await ctx.db.query("vessels").collect();
    return vessels.map(stripConvexMeta);
  },
});

/**
 * Resolve a single vessel from the canonical table using one selector field.
 *
 * @param ctx - Convex internal query context
 * @param args.selector - Exactly one vessel selector field
 * @returns Matching vessel, or `null` when not found
 */
export const resolveCanonicalVesselInternal = internalQuery({
  args: {
    selector: vesselSelectorSchema,
  },
  returns: v.union(vesselSchema, v.null()),
  handler: async (ctx, args) => {
    const vessels = await ctx.db.query("vessels").collect();
    const strippedVessels = vessels.map(stripConvexMeta);
    const selector = args.selector as VesselSelector;

    return resolveVessel(selector, strippedVessels) ?? null;
  },
});
