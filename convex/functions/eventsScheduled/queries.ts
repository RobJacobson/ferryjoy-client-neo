/**
 * Internal schedule-backed lookup queries for normalized boundary events.
 */

import type { QueryCtx } from "_generated/server";
import { internalQuery } from "_generated/server";
import { v } from "convex/values";
import { resolveActiveTimelineInterval } from "shared/activeTimelineInterval";
import { buildBoundaryKey } from "shared/keys";
import { getSailingDay } from "shared/time";
import type { ConvexActualBoundaryEvent } from "../eventsActual/schemas";
import { mergeTimelineEvents } from "../../domain/vesselTimeline/timelineEvents";
import type { ConvexScheduledBoundaryEvent } from "./schemas";
import { inferredScheduledSegmentSchema } from "./schemas";
import {
  buildInferredScheduledSegment,
  findNextDepartureEvent,
} from "./segmentResolvers";

/**
 * Resolves one scheduled departure segment by its stable segment key.
 *
 * @param args.segmentKey - Canonical segment key shared with `vesselTrips`
 * @returns The departure segment plus its next scheduled successor, or `null`
 */
export const getScheduledDepartureSegmentBySegmentKey = internalQuery({
  args: {
    segmentKey: v.string(),
  },
  returns: v.union(inferredScheduledSegmentSchema, v.null()),
  handler: async (ctx, args) => {
    const event = await loadScheduledDepartureEventBySegmentKey(
      ctx,
      args.segmentKey
    );

    if (!event) {
      return null;
    }

    return inferScheduledSegment(ctx, event);
  },
});

/**
 * Resolves the next same-day departure at the same terminal after a known
 * prior trip.
 *
 * @param args - Vessel, terminal, and prior scheduled departure context
 * @returns The next scheduled segment after the prior departure, or `null`
 */
export const getNextDepartureSegmentAfterDeparture = internalQuery({
  args: {
    vesselAbbrev: v.string(),
    departingTerminalAbbrev: v.string(),
    previousScheduledDeparture: v.number(),
  },
  returns: v.union(inferredScheduledSegmentSchema, v.null()),
  handler: async (ctx, args) => {
    const event = findNextDepartureEvent(
      await loadSameDayScheduledBoundaryEventsAfterTime(
        ctx,
        args.vesselAbbrev,
        args.previousScheduledDeparture
      ),
      {
        terminalAbbrev: args.departingTerminalAbbrev,
        afterTime: args.previousScheduledDeparture,
      }
    );

    return event ? inferScheduledSegment(ctx, event) : null;
  },
});

/**
 * Resolves the departure that owns a vessel's current same-day dock interval.
 *
 * @param args - Vessel, terminal, and sailing day scope
 * @returns The scheduled segment owning the current dock interval, or `null`
 */
export const getDockedDepartureSegmentForVesselAtTerminal = internalQuery({
  args: {
    vesselAbbrev: v.string(),
    departingTerminalAbbrev: v.string(),
    sailingDay: v.string(),
  },
  returns: v.union(inferredScheduledSegmentSchema, v.null()),
  handler: async (ctx, args) => {
    const [scheduledEvents, actualEvents] = await Promise.all([
      loadScheduledBoundaryEventsForSailingDay(
        ctx,
        args.vesselAbbrev,
        args.sailingDay
      ),
      loadActualBoundaryEventsForSailingDay(
        ctx,
        args.vesselAbbrev,
        args.sailingDay
      ),
    ]);
    const departureEvent = resolveDockedDepartureEventFromSameDayTimeline(
      scheduledEvents,
      actualEvents,
      args.departingTerminalAbbrev
    );

    return departureEvent ? inferScheduledSegment(ctx, departureEvent) : null;
  },
});

/**
 * Builds the portable segment shape returned to callers from a departure event.
 *
 * @param ctx - Convex query context
 * @param departureEvent - Scheduled departure boundary that owns the segment
 * @returns The inferred segment plus optional next-segment metadata
 */
const inferScheduledSegment = async (
  ctx: QueryCtx,
  departureEvent: ConvexScheduledBoundaryEvent
) => {
  const nextDepartureEvent = findNextDepartureEvent(
    await loadSameDayScheduledBoundaryEventsAfterTime(
      ctx,
      departureEvent.VesselAbbrev,
      departureEvent.ScheduledDeparture
    ),
    {
      afterTime: departureEvent.ScheduledDeparture,
    }
  );

  return buildInferredScheduledSegment(departureEvent, nextDepartureEvent);
};

/**
 * Resolves the departure event owning the current dock interval from same-day
 * scheduled and actual boundary tables.
 *
 * @param scheduledEvents - Same-day scheduled boundary rows
 * @param actualEvents - Same-day actual boundary rows
 * @param departingTerminalAbbrev - Terminal where the vessel is currently docked
 * @returns Owning departure boundary, or `null`
 */
const resolveDockedDepartureEventFromSameDayTimeline = (
  scheduledEvents: ConvexScheduledBoundaryEvent[],
  actualEvents: ConvexActualBoundaryEvent[],
  departingTerminalAbbrev: string
) => {
  const events = mergeTimelineEvents({
    scheduledEvents,
    actualEvents,
    predictedEvents: [],
  });
  const activeInterval = resolveActiveTimelineInterval(events);

  if (
    activeInterval?.kind !== "at-dock" ||
    activeInterval.endEventKey === null
  ) {
    return null;
  }

  const departureEvent =
    scheduledEvents.find((event) => event.Key === activeInterval.endEventKey) ??
    null;

  return departureEvent?.TerminalAbbrev === departingTerminalAbbrev
    ? departureEvent
    : null;
};

/**
 * Loads the scheduled departure boundary for a stable segment key.
 *
 * @param ctx - Convex query context
 * @param segmentKey - Stable trip/segment key
 * @returns Matching departure boundary, or `null`
 */
const loadScheduledDepartureEventBySegmentKey = async (
  ctx: QueryCtx,
  segmentKey: string
) =>
  ctx.db
    .query("eventsScheduled")
    .withIndex("by_key", (q) =>
      q.eq("Key", buildBoundaryKey(segmentKey, "dep-dock"))
    )
    .unique();

/**
 * Loads scheduled boundary events for one vessel and sailing day.
 *
 * @param ctx - Convex query context
 * @param vesselAbbrev - Vessel abbreviation
 * @param sailingDay - Sailing day in YYYY-MM-DD format
 * @returns Matching same-day scheduled boundary events
 */
const loadScheduledBoundaryEventsForSailingDay = async (
  ctx: QueryCtx,
  vesselAbbrev: string,
  sailingDay: string
) =>
  ctx.db
    .query("eventsScheduled")
    .withIndex("by_vessel_and_sailing_day", (q) =>
      q.eq("VesselAbbrev", vesselAbbrev).eq("SailingDay", sailingDay)
    )
    .collect();

/**
 * Loads actual boundary events for one vessel and sailing day.
 *
 * @param ctx - Convex query context
 * @param vesselAbbrev - Vessel abbreviation
 * @param sailingDay - Sailing day in YYYY-MM-DD format
 * @returns Matching same-day actual boundary events
 */
const loadActualBoundaryEventsForSailingDay = async (
  ctx: QueryCtx,
  vesselAbbrev: string,
  sailingDay: string
) =>
  ctx.db
    .query("eventsActual")
    .withIndex("by_vessel_and_sailing_day", (q) =>
      q.eq("VesselAbbrev", vesselAbbrev).eq("SailingDay", sailingDay)
    )
    .collect();

/**
 * Loads same-day scheduled events at or after a reference time.
 *
 * @param ctx - Convex query context
 * @param vesselAbbrev - Vessel abbreviation
 * @param afterTime - Lower bound timestamp in epoch ms
 * @returns Same-day candidate scheduled boundary events
 */
const loadSameDayScheduledBoundaryEventsAfterTime = async (
  ctx: QueryCtx,
  vesselAbbrev: string,
  afterTime: number
) =>
  loadScheduledBoundaryEventsForSailingDay(
    ctx,
    vesselAbbrev,
    getSailingDay(new Date(afterTime))
  );
