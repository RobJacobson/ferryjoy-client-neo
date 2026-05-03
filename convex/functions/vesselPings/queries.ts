/**
 * Query handlers for recent vessel ping rows.
 */

import { query } from "_generated/server";
import { ConvexError, v } from "convex/values";

import { stripConvexMeta } from "../../shared/stripConvexMeta";
import { vesselPingValidationSchema } from "./schemas";

/** Default lookback when loading pings for the map (10 minutes). */
const DEFAULT_LOOKBACK_MS = 10 * 60 * 1000;

/**
 * Returns recent vessel pings for map display within a lookback window.
 *
 * Client passes `nowMs` to anchor the window; defaults to ten minutes when
 * `lookbackMs` is omitted. Strips Convex system fields from results.
 *
 * @param ctx - Convex query context
 * @param args - Client wall clock and optional lookback window
 * @returns Pings in the window, without system fields
 */
export const getLatest = query({
  args: {
    nowMs: v.number(),
    lookbackMs: v.optional(v.number()),
  },
  returns: v.array(vesselPingValidationSchema),
  handler: async (ctx, args) => {
    try {
      const lookbackMs = args.lookbackMs ?? DEFAULT_LOOKBACK_MS;
      const since = args.nowMs - lookbackMs;

      const latestPings = await ctx.db
        .query("vesselPings")
        .withIndex("by_timestamp", (q) => q.gte("TimeStamp", since))
        .collect();

      return latestPings.map(stripConvexMeta);
    } catch (error) {
      throw new ConvexError({
        message: "Failed to fetch recent vessel pings",
        code: "QUERY_FAILED",
        severity: "error",
        details: { error: String(error) },
      });
    }
  },
});
