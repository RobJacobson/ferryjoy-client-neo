/**
 * Query handlers for recent legacy individual vessel ping rows.
 */

import { query } from "_generated/server";
import { ConvexError, v } from "convex/values";
import { vesselPingValidationSchema } from "functions/vesselPings/schemas";
import { stripConvexMeta } from "../../shared/stripConvexMeta";

/**
 * Get all vessel pings from the last 10 minutes using index search
 * Returns individual vessel ping documents, not collections
 *
 * @param ctx - Convex query context
 * @returns Array of vessel ping records from the last 10 minutes without metadata
 */
export const getLatest = query({
  args: {},
  returns: v.array(vesselPingValidationSchema),
  handler: async (ctx) => {
    try {
      const tenMinutesAgo = Date.now() - 10 * 60 * 1000;

      const latestPings = await ctx.db
        .query("vesselPing")
        .withIndex("by_timestamp", (q) => q.gte("TimeStamp", tenMinutesAgo))
        .collect();

      return latestPings.map(stripConvexMeta);
    } catch (error) {
      throw new ConvexError({
        message: "Failed to fetch vessel pings from the last 10 minutes",
        code: "QUERY_FAILED",
        severity: "error",
        details: {
          error: String(error),
          timestamp: Date.now(),
          timeRange: "last 10 minutes",
        },
      });
    }
  },
});
