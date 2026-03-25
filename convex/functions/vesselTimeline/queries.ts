/**
 * Exposes normalized VesselTimeline queries.
 */

import { internalQuery, query, type QueryCtx } from "_generated/server";
import { v } from "convex/values";
import { normalizeScheduledDockSeams, sortVesselTripEvents } from "domain/vesselTimeline/events";
import { stripConvexMeta } from "../../shared/stripConvexMeta";
import {
  eventsActualSchema,
  eventsPredictedSchema,
  eventsScheduledSchema,
  mergedTimelineBoundaryEventSchema,
} from "./schemas";

/**
 * Returns scheduled boundary events for one vessel and sailing day.
 */
export const getVesselTimelineScheduledEvents = query({
  args: {
    VesselAbbrev: v.string(),
    SailingDay: v.string(),
  },
  returns: v.array(eventsScheduledSchema),
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("eventsScheduled")
      .withIndex("by_vessel_and_sailing_day", (q) =>
        q
          .eq("VesselAbbrev", args.VesselAbbrev)
          .eq("SailingDay", args.SailingDay)
      )
      .collect();

    return docs
      .map(stripConvexMeta)
      .sort(sortScheduledBoundaryEvents);
  },
});

/**
 * Returns actual boundary overlays for one vessel and sailing day.
 */
export const getVesselTimelineActualEvents = query({
  args: {
    VesselAbbrev: v.string(),
    SailingDay: v.string(),
  },
  returns: v.array(eventsActualSchema),
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("eventsActual")
      .withIndex("by_vessel_and_sailing_day", (q) =>
        q
          .eq("VesselAbbrev", args.VesselAbbrev)
          .eq("SailingDay", args.SailingDay)
      )
      .collect();

    return docs
      .map(stripConvexMeta)
      .sort((left, right) => left.ScheduledDeparture - right.ScheduledDeparture);
  },
});

/**
 * Returns predicted boundary overlays for one vessel and sailing day.
 */
export const getVesselTimelinePredictedEvents = query({
  args: {
    VesselAbbrev: v.string(),
    SailingDay: v.string(),
  },
  returns: v.array(eventsPredictedSchema),
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("eventsPredicted")
      .withIndex("by_vessel_and_sailing_day", (q) =>
        q
          .eq("VesselAbbrev", args.VesselAbbrev)
          .eq("SailingDay", args.SailingDay)
      )
      .collect();

    return docs
      .map(stripConvexMeta)
      .sort((left, right) => left.ScheduledDeparture - right.ScheduledDeparture);
  },
});

/**
 * Returns merged boundary events for one vessel/day so server-side consumers
 * can resolve active state from the normalized tables.
 */
export const getMergedBoundaryEventsForVesselDay = internalQuery({
  args: {
    VesselAbbrev: v.string(),
    SailingDay: v.string(),
  },
  returns: v.array(mergedTimelineBoundaryEventSchema),
  handler: async (ctx, args) => {
    return await getMergedBoundaryEvents(ctx, args);
  },
});

const getMergedBoundaryEvents = async (
  ctx: QueryCtx,
  args: {
    VesselAbbrev: string;
    SailingDay: string;
  }
) => {
  const [scheduledDocs, actualDocs, predictedDocs] = await Promise.all([
    ctx.db
      .query("eventsScheduled")
      .withIndex("by_vessel_and_sailing_day", (q) =>
        q
          .eq("VesselAbbrev", args.VesselAbbrev)
          .eq("SailingDay", args.SailingDay)
      )
      .collect(),
    ctx.db
      .query("eventsActual")
      .withIndex("by_vessel_and_sailing_day", (q) =>
        q
          .eq("VesselAbbrev", args.VesselAbbrev)
          .eq("SailingDay", args.SailingDay)
      )
      .collect(),
    ctx.db
      .query("eventsPredicted")
      .withIndex("by_vessel_and_sailing_day", (q) =>
        q
          .eq("VesselAbbrev", args.VesselAbbrev)
          .eq("SailingDay", args.SailingDay)
      )
      .collect(),
  ]);

  const actualByKey = new Map(
    actualDocs.map((doc) => {
      const actual = stripConvexMeta(doc);
      return [actual.Key, actual] as const;
    })
  );
  const predictedByKey = new Map(
    predictedDocs.map((doc) => {
      const predicted = stripConvexMeta(doc);
      return [predicted.Key, predicted] as const;
    })
  );

  const merged = scheduledDocs.map((doc) => {
    const scheduled = stripConvexMeta(doc);
    return {
      Key: scheduled.Key,
      VesselAbbrev: scheduled.VesselAbbrev,
      SailingDay: scheduled.SailingDay,
      ScheduledDeparture: scheduled.ScheduledDeparture,
      TerminalAbbrev: scheduled.TerminalAbbrev,
      EventType: scheduled.EventType,
      ScheduledTime: scheduled.ScheduledTime,
      PredictedTime: predictedByKey.get(scheduled.Key)?.PredictedTime,
      ActualTime: actualByKey.get(scheduled.Key)?.ActualTime,
    };
  });

  return normalizeScheduledDockSeams(merged).sort(sortVesselTripEvents);
};

const sortScheduledBoundaryEvents = (
  left: {
    ScheduledDeparture: number;
    EventType: "dep-dock" | "arv-dock";
    TerminalAbbrev: string;
  },
  right: {
    ScheduledDeparture: number;
    EventType: "dep-dock" | "arv-dock";
    TerminalAbbrev: string;
  }
) =>
  left.ScheduledDeparture - right.ScheduledDeparture ||
  getEventTypeOrder(left.EventType) - getEventTypeOrder(right.EventType) ||
  left.TerminalAbbrev.localeCompare(right.TerminalAbbrev);

const getEventTypeOrder = (eventType: "dep-dock" | "arv-dock") =>
  eventType === "dep-dock" ? 0 : 1;
