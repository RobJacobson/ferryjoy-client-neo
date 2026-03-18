import { query } from "_generated/server";
import { v } from "convex/values";
import { sortVesselTripEvents } from "domain/vesselTripEvents";
import { stripConvexMeta } from "shared/stripConvexMeta";
import { vesselTripEventSchema } from "./schemas";

export const getVesselDayTimelineEvents = query({
  args: {
    VesselAbbrev: v.string(),
    SailingDay: v.string(),
  },
  returns: v.object({
    VesselAbbrev: v.string(),
    SailingDay: v.string(),
    Events: v.array(vesselTripEventSchema),
  }),
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("vesselTripEvents")
      .withIndex("by_vessel_and_sailing_day", (q) =>
        q
          .eq("VesselAbbrev", args.VesselAbbrev)
          .eq("SailingDay", args.SailingDay)
      )
      .collect();

    return {
      VesselAbbrev: args.VesselAbbrev,
      SailingDay: args.SailingDay,
      Events: docs.map(stripConvexMeta).sort(sortVesselTripEvents),
    };
  },
});
