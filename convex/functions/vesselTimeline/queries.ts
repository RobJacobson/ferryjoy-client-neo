/**
 * Exposes normalized VesselTimeline queries.
 */

import { query } from "_generated/server";
import { v } from "convex/values";
import { stripConvexMeta } from "../../shared/stripConvexMeta";
import {
  eventsActualSchema,
  eventsScheduledSchema,
  timelinePredictedBoundaryEventSchema,
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
  returns: v.array(timelinePredictedBoundaryEventSchema),
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
      .map((doc) => {
        const predicted = stripConvexMeta(doc);
        return {
          Key: predicted.Key,
          VesselAbbrev: predicted.VesselAbbrev,
          SailingDay: predicted.SailingDay,
          ScheduledDeparture: predicted.ScheduledDeparture,
          TerminalAbbrev: predicted.TerminalAbbrev,
          EventPredictedTime: predicted.EventPredictedTime,
        };
      })
      .sort((left, right) => left.ScheduledDeparture - right.ScheduledDeparture);
  },
});

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
