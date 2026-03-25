/**
 * Exposes query helpers for reading the `vesselTripEvents` read model from
 * Convex.
 */
import { internal } from "_generated/api";
import { internalQuery, type QueryCtx, query } from "_generated/server";
import { v } from "convex/values";
import {
  normalizeScheduledDockSeams,
  resolveVesselTimelineActiveState,
  sortVesselTripEvents,
} from "domain/vesselTimeline/events";
import { stripConvexMeta } from "shared/stripConvexMeta";
import { vesselTimelineActiveStateSnapshotSchema } from "./activeStateSchemas";
import { vesselTripEventSchema } from "./schemas";

export const getVesselDayActiveState = query({
  args: {
    VesselAbbrev: v.string(),
    SailingDay: v.string(),
  },
  returns: vesselTimelineActiveStateSnapshotSchema,
  handler: async (ctx, args) => {
    const [Events, vesselLocation] = await Promise.all([
      ctx.runQuery(
        internal.functions.vesselTimeline.queries.getMergedBoundaryEventsForVesselDay,
        args
      ),
      ctx.db
        .query("vesselLocations")
        .withIndex("by_vessel_abbrev", (q) =>
          q.eq("VesselAbbrev", args.VesselAbbrev)
        )
        .unique(),
    ]);

    const resolved = resolveVesselTimelineActiveState({
      events: Events,
      location: vesselLocation ? stripConvexMeta(vesselLocation) : undefined,
    });

    return {
      VesselAbbrev: args.VesselAbbrev,
      SailingDay: args.SailingDay,
      ObservedAt: resolved.ObservedAt,
      Live: resolved.Live,
      ActiveState: resolved.ActiveState,
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

    return normalizeScheduledDockSeams(
      Array.from(
        new Map(
          docs.map((doc) => {
            const event = stripConvexMeta(doc);
            return [event.Key, event];
          })
        ).values()
      ).sort(sortVesselTripEvents)
    );
  },
});

const getOrderedEventsForVesselDay = async (
  ctx: QueryCtx,
  args: {
    VesselAbbrev: string;
    SailingDay: string;
  }
) => {
  const docs = await ctx.db
    .query("vesselTripEvents")
    .withIndex("by_vessel_and_sailing_day", (q) =>
      q.eq("VesselAbbrev", args.VesselAbbrev).eq("SailingDay", args.SailingDay)
    )
    .collect();

  return normalizeScheduledDockSeams(
    Array.from(
      new Map(
        docs.map((doc) => {
          const event = stripConvexMeta(doc);
          return [event.Key, event];
        })
      ).values()
    ).sort(sortVesselTripEvents)
  );
};
