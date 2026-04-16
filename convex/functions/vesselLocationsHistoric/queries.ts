/**
 * Public read queries for historic vessel-location snapshots.
 */

import { query } from "_generated/server";
import { v } from "convex/values";
import { stripConvexMeta } from "shared/stripConvexMeta";
import { historicVesselLocationValidationSchema } from "./schemas";

/**
 * Fetch all historic vessel-location rows for one vessel and sailing day.
 *
 * Rows are sorted by ascending `TimeStamp` so downstream scripts can replay
 * the vessel's day as a simple chronology.
 *
 * @param ctx - Convex query context
 * @param args - Query arguments containing the vessel abbreviation and sailing day
 * @returns Historic vessel-location rows sorted by ascending timestamp
 */
export const getByVesselAndSailingDay = query({
  args: {
    vesselAbbrev: v.string(),
    sailingDay: v.string(),
  },
  returns: v.array(historicVesselLocationValidationSchema),
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("vesselLocationsHistoric")
      .withIndex("by_vessel_abbrev_and_sailing_day", (q) =>
        q
          .eq("VesselAbbrev", args.vesselAbbrev)
          .eq("SailingDay", args.sailingDay)
      )
      .collect();

    return docs
      .map(stripConvexMeta)
      .sort((left, right) => left.TimeStamp - right.TimeStamp);
  },
});
