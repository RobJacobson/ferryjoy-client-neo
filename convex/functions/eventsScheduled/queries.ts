import type { QueryCtx } from "_generated/server";
import { internalQuery } from "_generated/server";
import { v } from "convex/values";
import { buildBoundaryKey } from "shared/keys";
import { getSailingDay } from "shared/time";
import type {
  ConvexInferredScheduledSegment,
  ConvexScheduledBoundaryEvent,
} from "./schemas";
import { inferredScheduledSegmentSchema } from "./schemas";

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
): Promise<ConvexInferredScheduledSegment> => {
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

export const findDockedDepartureEvent = (
  events: ConvexScheduledBoundaryEvent[],
  terminalAbbrev: string,
  observedAt: number
) => {
  const sortedEvents = [...events].sort(sortScheduledBoundaryEvents);
  const latestArrival = [...sortedEvents]
    .reverse()
    .find(
      (event) =>
        event.EventType === "arv-dock" &&
        event.TerminalAbbrev === terminalAbbrev &&
        getBoundaryTime(event) <= observedAt
    );

  if (latestArrival) {
    return (
      sortedEvents.find(
        (event) =>
          event.EventType === "dep-dock" &&
          event.TerminalAbbrev === terminalAbbrev &&
          getBoundaryTime(event) >= getBoundaryTime(latestArrival)
      ) ?? null
    );
  }

  return (
    sortedEvents.find(
      (event) =>
        event.EventType === "dep-dock" &&
        event.TerminalAbbrev === terminalAbbrev &&
        getBoundaryTime(event) >= observedAt
    ) ?? null
  );
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

const getBoundaryTime = (
  event: Pick<
    ConvexScheduledBoundaryEvent,
    "EventScheduledTime" | "ScheduledDeparture"
  >
) => event.EventScheduledTime ?? event.ScheduledDeparture;

const addDays = (dateString: string, days: number): string => {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return getSailingDay(date);
};

const sortScheduledBoundaryEvents = (
  left: ConvexScheduledBoundaryEvent,
  right: ConvexScheduledBoundaryEvent
) =>
  getBoundaryTime(left) - getBoundaryTime(right) ||
  getEventTypeOrder(left.EventType) - getEventTypeOrder(right.EventType) ||
  left.TerminalAbbrev.localeCompare(right.TerminalAbbrev);

const getEventTypeOrder = (
  eventType: ConvexScheduledBoundaryEvent["EventType"]
) =>
  eventType === "arv-dock" ? 0 : 1;
