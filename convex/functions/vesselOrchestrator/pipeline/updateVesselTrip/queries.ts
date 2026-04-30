/**
 * Internal queries for key-first vessel-trip schedule resolution.
 */

import { internalQuery } from "_generated/server";
import { v } from "convex/values";
import { inferScheduledSegmentFromDepartureEvent } from "domain/timelineRows/scheduledSegmentResolvers";
import { queryScheduledDockEventsForVesselSailingDay } from "functions/events/eventsScheduled/queries";
import {
  type ConvexScheduledDockEvent,
  eventsScheduledSchema,
} from "functions/events/eventsScheduled/schemas";
import { buildBoundaryKey } from "shared/keys";
import { stripConvexMeta } from "shared/stripConvexMeta";
import { addDaysToYyyyMmDd, getSailingDay } from "shared/time";

const inferredScheduledSegmentSchema = v.object({
  Key: v.string(),
  SailingDay: v.string(),
  DepartingTerminalAbbrev: v.string(),
  ArrivingTerminalAbbrev: v.string(),
  DepartingTime: v.number(),
  NextKey: v.optional(v.string()),
  NextDepartingTime: v.optional(v.number()),
});

/**
 * Primary schedule lookup: resolve a known segment key into an inferred segment.
 */
export const getScheduledSegmentByScheduleKeyInternal = internalQuery({
  args: {
    scheduleKey: v.string(),
  },
  returns: v.union(inferredScheduledSegmentSchema, v.null()),
  handler: async (ctx, args) => {
    const departureEvent = await ctx.db
      .query("eventsScheduled")
      .withIndex("by_key", (q) =>
        q.eq("Key", buildBoundaryKey(args.scheduleKey, "dep-dock"))
      )
      .unique();

    if (!departureEvent) {
      return null;
    }

    const departureRow = stripConvexMeta(departureEvent);
    const sameDayEvents = await queryScheduledDockEventsForVesselSailingDay(
      ctx,
      {
        vesselAbbrev: departureRow.VesselAbbrev,
        sailingDay: departureRow.SailingDay,
      }
    );

    return inferScheduledSegmentFromDepartureEvent(
      departureRow,
      sameDayEvents as ConvexScheduledDockEvent[]
    );
  },
});

/**
 * Fallback schedule lookup: load current and next sailing-day dock rows.
 */
export const getScheduleRolloverDockEventsInternal = internalQuery({
  args: {
    vesselAbbrev: v.string(),
    timestamp: v.number(),
  },
  returns: v.object({
    currentSailingDay: v.string(),
    currentDayEvents: v.array(eventsScheduledSchema),
    nextSailingDay: v.string(),
    nextDayEvents: v.array(eventsScheduledSchema),
  }),
  handler: async (ctx, args) => {
    const currentSailingDay = getSailingDay(new Date(args.timestamp));
    const nextSailingDay = addDaysToYyyyMmDd(currentSailingDay, 1);
    const [currentDayEvents, nextDayEvents] = await Promise.all([
      queryScheduledDockEventsForVesselSailingDay(ctx, {
        vesselAbbrev: args.vesselAbbrev,
        sailingDay: currentSailingDay,
      }),
      queryScheduledDockEventsForVesselSailingDay(ctx, {
        vesselAbbrev: args.vesselAbbrev,
        sailingDay: nextSailingDay,
      }),
    ]);

    return {
      currentSailingDay,
      currentDayEvents,
      nextSailingDay,
      nextDayEvents,
    };
  },
});
