/**
 * Internal schedule-backed lookup queries for normalized boundary events.
 *
 * These helpers sit at the Convex boundary so the pure selection rules can
 * stay in `segmentResolvers.ts` while database/index orchestration stays here.
 * The cost of that split is that some lookups intentionally read multiple
 * sailing days, because dock ownership and next-trip continuity can cross the
 * visible service-day boundary.
 */

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
    return findScheduledDepartureSegmentBySegmentKey(ctx, args.segmentKey);
  },
});

/**
 * Resolves the next departure at the same terminal after a known prior trip.
 *
 * This is the rollover lookup used when a vessel has just completed one trip
 * and we want the next scheduled departure it should still be attached to,
 * even if that departure is already slightly in the past.
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
    return findNextDepartureSegmentAfterDeparture(ctx, args);
  },
});

/**
 * Resolves the departure that owns a vessel's current dock interval.
 *
 * This is intentionally different from "the next future departure after now":
 * it first looks for the latest arrival at the observed terminal and then
 * finds the departure that follows that arrival, which keeps delayed sailings
 * attached to the correct dock row.
 *
 * @param args - Vessel, terminal, and observation timestamp
 * @returns The scheduled segment owning the dock interval, or `null`
 */
export const getDockedDepartureSegmentForVesselAtTerminal = internalQuery({
  args: {
    vesselAbbrev: v.string(),
    departingTerminalAbbrev: v.string(),
    observedAt: v.number(),
  },
  returns: v.union(inferredScheduledSegmentSchema, v.null()),
  handler: async (ctx, args) => {
    return findDockedDepartureSegmentForVesselAtTerminal(ctx, args);
  },
});

/**
 * Resolve one scheduled departure segment by its stable segment key.
 *
 * Exported for query-time consumers that need the same normalized segment
 * lookup without going through an internal Convex function hop.
 */
export const findScheduledDepartureSegmentBySegmentKey = async (
  ctx: QueryCtx,
  segmentKey: string
) => {
  const event = await loadScheduledDepartureEventBySegmentKey(ctx, segmentKey);

  if (!event) {
    return null;
  }

  return inferScheduledSegment(ctx, event);
};

/**
 * Resolve the next departure at the same terminal after a known prior trip.
 */
export const findNextDepartureSegmentAfterDeparture = async (
  ctx: QueryCtx,
  args: {
    vesselAbbrev: string;
    departingTerminalAbbrev: string;
    previousScheduledDeparture: number;
  }
) => {
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
};

/**
 * Resolve the scheduled departure segment that owns the current dock interval.
 */
export const findDockedDepartureSegmentForVesselAtTerminal = async (
  ctx: QueryCtx,
  args: {
    vesselAbbrev: string;
    departingTerminalAbbrev: string;
    observedAt: number;
  }
) => {
  // Dock ownership needs a small cross-day window so the pure resolver can
  // decide whether this vessel still belongs to the current dock interval or
  // has already rolled into the next scheduled departure.
  const departureEvent = findDockedDepartureEvent(
    await loadScheduledBoundaryEventsAroundTime(
      ctx,
      args.vesselAbbrev,
      args.observedAt
    ),
    args.departingTerminalAbbrev
  );

  return departureEvent ? inferScheduledSegment(ctx, departureEvent) : null;
};

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
  // The inferred segment intentionally carries "what comes after this trip?"
  // so callers in `vesselTrips` and `vesselTimeline` can preserve continuity
  // without consulting trip-shaped tables.
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
 * Loads a cross-day window of scheduled events around an observation time.
 *
 * Dock ownership can cross the sailing-day boundary, so the docked lookup
 * reads the previous, current, and next sailing days before delegating the
 * actual selection logic to `findDockedDepartureEvent`.
 *
 * @param ctx - Convex query context
 * @param vesselAbbrev - Vessel abbreviation
 * @param observedAt - Observation timestamp in epoch ms
 * @returns Flat list of candidate scheduled boundary events
 */
const loadScheduledBoundaryEventsAroundTime = async (
  ctx: QueryCtx,
  vesselAbbrev: string,
  observedAt: number
) => {
  const currentSailingDay = getSailingDay(new Date(observedAt));
  return loadScheduledBoundaryEventsForSailingDays(ctx, vesselAbbrev, [
    addDays(currentSailingDay, -1),
    currentSailingDay,
    addDays(currentSailingDay, 1),
  ]);
};

/**
 * Loads scheduled events at or after a reference time across the day boundary.
 *
 * The next logical departure may be on the next sailing day, so callers fetch
 * both the current and next days and let the pure resolver choose the first
 * matching departure.
 *
 * @param ctx - Convex query context
 * @param vesselAbbrev - Vessel abbreviation
 * @param afterTime - Lower bound timestamp in epoch ms
 * @returns Flat list of candidate scheduled boundary events
 */
const loadScheduledBoundaryEventsAfterTime = async (
  ctx: QueryCtx,
  vesselAbbrev: string,
  afterTime: number
) => {
  const currentSailingDay = getSailingDay(new Date(afterTime));
  return loadScheduledBoundaryEventsForSailingDays(ctx, vesselAbbrev, [
    currentSailingDay,
    addDays(currentSailingDay, 1),
  ]);
};

/**
 * Loads scheduled boundary events for a fixed set of sailing days.
 *
 * @param ctx - Convex query context
 * @param vesselAbbrev - Vessel abbreviation
 * @param sailingDays - Ordered list of sailing days to query
 * @returns Flat list of all matching boundary events
 */
const loadScheduledBoundaryEventsForSailingDays = async (
  ctx: QueryCtx,
  vesselAbbrev: string,
  sailingDays: string[]
) =>
  // Keep the reads separate per sailing day so each query stays index-friendly
  // on `by_vessel_and_sailing_day`, then flatten for the pure resolver layer.
  (
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

/**
 * Adds whole days to a sailing-day string without drifting local service-day
 * boundaries.
 *
 * @param dateString - Sailing day in YYYY-MM-DD format
 * @param days - Whole-day delta
 * @returns Shifted sailing day string
 */
const addDays = (dateString: string, days: number): string => {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return getSailingDay(date);
};
