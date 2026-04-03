import type { QueryCtx } from "_generated/server";
import { internalQuery } from "_generated/server";
import { v } from "convex/values";
import { buildBoundaryKey } from "shared/keys";
import { getSailingDay } from "shared/time";

const inferredScheduledSegmentSchema = v.object({
  Key: v.string(),
  SailingDay: v.string(),
  DepartingTerminalAbbrev: v.string(),
  ArrivingTerminalAbbrev: v.string(),
  DepartingTime: v.number(),
  NextKey: v.optional(v.string()),
  NextDepartingTime: v.optional(v.number()),
});

type InferredScheduledSegment = {
  Key: string;
  SailingDay: string;
  DepartingTerminalAbbrev: string;
  ArrivingTerminalAbbrev: string;
  DepartingTime: number;
  NextKey?: string;
  NextDepartingTime?: number;
};

export const getScheduledDepartureSegmentBySegmentKey = internalQuery({
  args: {
    segmentKey: v.string(),
  },
  returns: v.union(inferredScheduledSegmentSchema, v.null()),
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("eventsScheduled")
      .withIndex("by_key", (q) =>
        q.eq("Key", buildBoundaryKey(args.segmentKey, "dep-dock"))
      )
      .unique();

    if (!event) {
      return null;
    }

    return inferScheduledSegment(ctx, event);
  },
});

export const getNextScheduledDepartureSegmentForVesselAtTerminal =
  internalQuery({
    args: {
      vesselAbbrev: v.string(),
      departingTerminalAbbrev: v.string(),
      arrivalTime: v.number(),
    },
    returns: v.union(inferredScheduledSegmentSchema, v.null()),
    handler: async (ctx, args) => {
      const event = await findNextDepartureEvent(ctx, {
        vesselAbbrev: args.vesselAbbrev,
        terminalAbbrev: args.departingTerminalAbbrev,
        afterTime: args.arrivalTime,
      });

      return event ? inferScheduledSegment(ctx, event) : null;
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
    const event = await findNextDepartureEvent(ctx, {
      vesselAbbrev: args.vesselAbbrev,
      terminalAbbrev: args.departingTerminalAbbrev,
      afterTime: args.previousScheduledDeparture,
    });

    return event ? inferScheduledSegment(ctx, event) : null;
  },
});

const inferScheduledSegment = async (
  ctx: QueryCtx,
  departureEvent: {
    Key: string;
    VesselAbbrev: string;
    SailingDay: string;
    TerminalAbbrev: string;
    NextTerminalAbbrev: string;
    ScheduledDeparture: number;
    EventScheduledTime?: number;
  }
): Promise<InferredScheduledSegment> => {
  const departureTime =
    departureEvent.EventScheduledTime ?? departureEvent.ScheduledDeparture;
  const nextDepartureEvent = await findNextDepartureEvent(ctx, {
    vesselAbbrev: departureEvent.VesselAbbrev,
    terminalAbbrev: undefined,
    afterTime: departureEvent.ScheduledDeparture,
  });

  return {
    Key: getSegmentKeyFromBoundaryKey(departureEvent.Key),
    SailingDay: departureEvent.SailingDay,
    DepartingTerminalAbbrev: departureEvent.TerminalAbbrev,
    ArrivingTerminalAbbrev: departureEvent.NextTerminalAbbrev,
    DepartingTime: departureTime,
    NextKey: nextDepartureEvent
      ? getSegmentKeyFromBoundaryKey(nextDepartureEvent.Key)
      : undefined,
    NextDepartingTime: nextDepartureEvent
      ? (nextDepartureEvent.EventScheduledTime ??
        nextDepartureEvent.ScheduledDeparture)
      : undefined,
  };
};

const findNextDepartureEvent = async (
  ctx: QueryCtx,
  args: {
    vesselAbbrev: string;
    terminalAbbrev?: string;
    afterTime: number;
  }
) => {
  const currentSailingDay = getSailingDay(new Date(args.afterTime));
  const nextSailingDay = addDays(currentSailingDay, 1);
  const candidateEvents = (
    await Promise.all(
      [currentSailingDay, nextSailingDay].map((sailingDay) =>
        ctx.db
          .query("eventsScheduled")
          .withIndex("by_vessel_and_sailing_day", (q) =>
            q.eq("VesselAbbrev", args.vesselAbbrev).eq("SailingDay", sailingDay)
          )
          .collect()
      )
    )
  )
    .flat()
    .filter(
      (event) =>
        event.EventType === "dep-dock" &&
        (args.terminalAbbrev === undefined ||
          event.TerminalAbbrev === args.terminalAbbrev) &&
        event.ScheduledDeparture > args.afterTime
    )
    .sort(
      (left, right) =>
        left.ScheduledDeparture - right.ScheduledDeparture ||
        left.TerminalAbbrev.localeCompare(right.TerminalAbbrev)
    );

  return candidateEvents[0] ?? null;
};

const getSegmentKeyFromBoundaryKey = (boundaryKey: string) =>
  boundaryKey.replace(/--(?:dep|arv)-dock$/, "");

const addDays = (dateString: string, days: number): string => {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return getSailingDay(date);
};
