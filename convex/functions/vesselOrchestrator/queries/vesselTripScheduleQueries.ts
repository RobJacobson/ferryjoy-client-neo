/**
 * Internal schedule reads for vessel-trip continuity: segment resolution from
 * `eventsScheduled` and sailing-day rollover pools used by `updateVesselTrip`.
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
 * Resolves a schedule segment from a known `scheduleKey` via dep-dock row.
 *
 * Looks up the departure boundary on `eventsScheduled`, loads same-day dock
 * events for that vessel and sailing day, then infers the segment shape used
 * for `NextScheduleKey` / continuity in the trip pipeline. Returns null when
 * the dep-dock row is missing.
 *
 * @param ctx - Convex query context
 * @param args - `scheduleKey` for the segment being resolved
 * @returns Inferred segment fields or null when no dep-dock event exists
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
 * Loads current and next sailing-day scheduled dock rows for rollover logic.
 *
 * Used when key-first segment lookup cannot supply continuity. Derives the
 * current sailing day from the sample timestamp and loads that day plus the
 * following calendar day for the same vessel abbrev.
 *
 * @param ctx - Convex query context
 * @param args - `vesselAbbrev` and epoch-ms `timestamp` for sailing-day math
 * @returns Current/next sailing-day strings and matching scheduled dock rows
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
