/**
 * Exposes query helpers for reading the `vesselTripEvents` read model from
 * Convex.
 */
import { internalQuery, query } from "_generated/server";
import { v } from "convex/values";
import { sortVesselTripEvents } from "domain/vesselTripEvents";
import { stripConvexMeta } from "shared/stripConvexMeta";
import { vesselTripEventSchema } from "./schemas";

/**
 * Returns the ordered dock-boundary event feed for one vessel on one sailing
 * day.
 */
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

    const eventsById = new Map(
      docs.map((doc) => {
        const event = stripConvexMeta(doc);
        return [event.Key, event];
      })
    );

    return {
      VesselAbbrev: args.VesselAbbrev,
      SailingDay: args.SailingDay,
      // Defensive dedupe keeps dirty duplicate rows from leaking out to
      // timeline consumers.
      Events: Array.from(eventsById.values()).sort(sortVesselTripEvents),
    };
  },
});

export const getEventsForSailingDay = internalQuery({
  args: {
    SailingDay: v.string(),
  },
  returns: v.array(vesselTripEventSchema),
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("vesselTripEvents")
      .withIndex("by_sailing_day", (q) => q.eq("SailingDay", args.SailingDay))
      .collect();

    const eventsById = new Map(
      docs.map((doc) => {
        const event = stripConvexMeta(doc);
        return [event.Key, event];
      })
    );

    return Array.from(eventsById.values()).sort(sortVesselTripEvents);
  },
});
