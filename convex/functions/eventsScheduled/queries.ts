import type { QueryCtx } from "_generated/server";
import { internalQuery } from "_generated/server";
import { v } from "convex/values";
import { buildBoundaryKey } from "shared/keys";
import { getSailingDay } from "shared/time";
import type { ConvexScheduledBoundaryEvent } from "./schemas";
import { inferredScheduledSegmentSchema } from "./schemas";
import {
  buildInferredScheduledSegment,
  findDockedDepartureEvent,
  findNextDepartureEvent,
} from "./segmentResolvers";

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

export const getNextDepartureSegmentAfterDeparture = internalQuery({
  args: {
    vesselAbbrev: v.string(),
    departingTerminalAbbrev: v.string(),
    previousScheduledDeparture: v.number(),
  },
  returns: v.union(inferredScheduledSegmentSchema, v.null()),
  handler: async (ctx, args) => {
    const event = findNextDepartureEvent(
      await loadScheduledBoundaryEventsAfterTime(
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

export const getDockedDepartureSegmentForVesselAtTerminal = internalQuery({
  args: {
    vesselAbbrev: v.string(),
    departingTerminalAbbrev: v.string(),
    observedAt: v.number(),
  },
  returns: v.union(inferredScheduledSegmentSchema, v.null()),
  handler: async (ctx, args) => {
    const departureEvent = findDockedDepartureEvent(
      await loadScheduledBoundaryEventsAroundTime(
        ctx,
        args.vesselAbbrev,
        args.observedAt
      ),
      args.departingTerminalAbbrev,
      args.observedAt
    );

    return departureEvent ? inferScheduledSegment(ctx, departureEvent) : null;
  },
});

const inferScheduledSegment = async (
  ctx: QueryCtx,
  departureEvent: ConvexScheduledBoundaryEvent
) => {
  const nextDepartureEvent = findNextDepartureEvent(
    await loadScheduledBoundaryEventsAfterTime(
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

const loadScheduledBoundaryEventsAroundTime = async (
  ctx: QueryCtx,
  vesselAbbrev: string,
  observedAt: number
) => {
  const currentSailingDay = getSailingDay(new Date(observedAt));
  const sailingDays = [
    addDays(currentSailingDay, -1),
    currentSailingDay,
    addDays(currentSailingDay, 1),
  ];

  return (
    await Promise.all(
      sailingDays.map((sailingDay) =>
        ctx.db
          .query("eventsScheduled")
          .withIndex("by_vessel_and_sailing_day", (q) =>
            q.eq("VesselAbbrev", vesselAbbrev).eq("SailingDay", sailingDay)
          )
          .collect()
      )
    )
  ).flat();
};

const loadScheduledBoundaryEventsAfterTime = async (
  ctx: QueryCtx,
  vesselAbbrev: string,
  afterTime: number
) => {
  const currentSailingDay = getSailingDay(new Date(afterTime));
  const nextSailingDay = addDays(currentSailingDay, 1);
  return (
    await Promise.all(
      [currentSailingDay, nextSailingDay].map((sailingDay) =>
        ctx.db
          .query("eventsScheduled")
          .withIndex("by_vessel_and_sailing_day", (q) =>
            q.eq("VesselAbbrev", vesselAbbrev).eq("SailingDay", sailingDay)
          )
          .collect()
      )
    )
  ).flat();
};

const addDays = (dateString: string, days: number): string => {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return getSailingDay(date);
};
