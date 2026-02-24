import { query } from "_generated/server";
import { ConvexError, v } from "convex/values";
import { stripConvexMeta } from "../../shared/stripConvexMeta";
import { vesselLocationValidationSchema } from "./schemas";

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
