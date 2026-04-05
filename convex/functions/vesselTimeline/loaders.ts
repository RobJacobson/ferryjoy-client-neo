/**
 * Convex-specific VesselTimeline loaders for the public event-first query.
 *
 * This module owns database access and query-time orchestration for the public
 * VesselTimeline query. The read path is intentionally scoped to one sailing
 * day plus the current `vesselLocations` row; pure event assembly and
 * attachment logic stay in the domain layer.
 */

import type { QueryCtx } from "_generated/server";
import { stripConvexMeta } from "../../shared/stripConvexMeta";
import { getSailingDay } from "../../shared/time";
import type { ConvexActualBoundaryEvent } from "../eventsActual/schemas";
import type { ConvexPredictedBoundaryEvent } from "../eventsPredicted/schemas";
import type { ConvexScheduledBoundaryEvent } from "../eventsScheduled/schemas";
import { sortScheduledBoundaryEvents } from "../eventsScheduled/segmentResolvers";
import type { ConvexVesselLocation } from "../vesselLocation/schemas";

export type LoadedVesselTimelineViewModelInputs = {
  scheduledEvents: ConvexScheduledBoundaryEvent[];
  actualEvents: ConvexActualBoundaryEvent[];
  predictedEvents: ConvexPredictedBoundaryEvent[];
  location: ConvexVesselLocation | null;
};

/**
 * Loads all inputs needed to build the backend-owned VesselTimeline view
 * model.
 *
 * @param ctx - Convex query context
 * @param args - Vessel/day scope
 * @returns Loaded inputs ready for domain assembly
 */
export const loadVesselTimelineViewModelInputs = async (
  ctx: QueryCtx,
  args: {
    VesselAbbrev: string;
    SailingDay: string;
  }
): Promise<LoadedVesselTimelineViewModelInputs> => {
  const [scheduledDocs, actualDocs, predictedDocs, locationDoc] =
    await Promise.all([
      loadScheduledBoundaryEventsForSailingDay(
        ctx,
        args.VesselAbbrev,
        args.SailingDay
      ),
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
      ctx.db
        .query("vesselLocations")
        .withIndex("by_vessel_abbrev", (q) =>
          q.eq("VesselAbbrev", args.VesselAbbrev)
        )
        .unique(),
    ]);

  const scheduledEvents = scheduledDocs.map(stripConvexMeta);
  const actualEvents = actualDocs.map(stripConvexMeta);
  const predictedEvents = predictedDocs.map(stripConvexMeta);
  const location = locationDoc ? stripConvexMeta(locationDoc) : null;
  const carryInArrival = await resolveCarryInArrival(
    ctx,
    args.VesselAbbrev,
    args.SailingDay,
    scheduledEvents
  );

  if (!carryInArrival) {
    return {
      scheduledEvents,
      actualEvents,
      predictedEvents,
      location,
    };
  }

  const [carryInActualDoc, carryInPredictedDoc] = await Promise.all([
    loadActualBoundaryEventByKey(ctx, carryInArrival.Key),
    loadPredictedBoundaryEventByKey(ctx, carryInArrival.Key),
  ]);

  return {
    scheduledEvents: [carryInArrival, ...scheduledEvents],
    actualEvents: carryInActualDoc
      ? [stripConvexMeta(carryInActualDoc), ...actualEvents]
      : actualEvents,
    predictedEvents: carryInPredictedDoc
      ? [stripConvexMeta(carryInPredictedDoc), ...predictedEvents]
      : predictedEvents,
    location,
  };
};

/**
 * Loads scheduled boundary events for one vessel and sailing day.
 *
 * @param ctx - Convex query context
 * @param vesselAbbrev - Vessel abbreviation
 * @param sailingDay - Sailing day in YYYY-MM-DD format
 * @returns Scheduled boundary-event documents for that vessel/day
 */
const loadScheduledBoundaryEventsForSailingDay = async (
  ctx: QueryCtx,
  vesselAbbrev: string,
  sailingDay: string
) => {
  return await ctx.db
    .query("eventsScheduled")
    .withIndex("by_vessel_and_sailing_day", (q) =>
      q.eq("VesselAbbrev", vesselAbbrev).eq("SailingDay", sailingDay)
    )
    .collect();
};

/**
 * Resolves the previous sailing day's indexed final arrival for the first dock
 * row when the visible day starts with a departure.
 *
 * The write path marks the latest arrival boundary in each sailing day. The
 * read path can then do one precise indexed lookup instead of scanning the
 * whole previous day.
 *
 * @param ctx - Convex query context
 * @param vesselAbbrev - Vessel abbreviation
 * @param sailingDay - Requested sailing day
 * @param sameDayEvents - Scheduled events already loaded for the requested day
 * @returns Carry-in scheduled arrival row, or `null`
 */
const resolveCarryInArrival = async (
  ctx: QueryCtx,
  vesselAbbrev: string,
  sailingDay: string,
  sameDayEvents: ConvexScheduledBoundaryEvent[]
) => {
  const sortedSameDayEvents = [...sameDayEvents].sort(
    sortScheduledBoundaryEvents
  );
  const firstDepartureIndex = sortedSameDayEvents.findIndex(
    (event) => event.EventType === "dep-dock"
  );
  const firstDepartureEvent =
    firstDepartureIndex >= 0 ? sortedSameDayEvents[firstDepartureIndex] : null;

  if (!firstDepartureEvent) {
    return null;
  }

  const hasSameDayArrival = sortedSameDayEvents
    .slice(0, firstDepartureIndex)
    .some(
      (event) =>
        event.EventType === "arv-dock" &&
        event.TerminalAbbrev === firstDepartureEvent.TerminalAbbrev
    );
  if (hasSameDayArrival) {
    return null;
  }

  const previousSailingDay = addDays(sailingDay, -1);
  const previousDayLastArrival = await loadLastArrivalForSailingDay(
    ctx,
    vesselAbbrev,
    previousSailingDay
  );

  return previousDayLastArrival?.TerminalAbbrev ===
    firstDepartureEvent.TerminalAbbrev
    ? stripConvexMeta(previousDayLastArrival)
    : null;
};

/**
 * Loads the indexed final arrival row for one vessel and sailing day.
 *
 * @param ctx - Convex query context
 * @param vesselAbbrev - Vessel abbreviation
 * @param sailingDay - Sailing day in YYYY-MM-DD format
 * @returns Flagged final-arrival row, or `null`
 */
const loadLastArrivalForSailingDay = async (
  ctx: QueryCtx,
  vesselAbbrev: string,
  sailingDay: string
) =>
  await ctx.db
    .query("eventsScheduled")
    .withIndex("by_vessel_sailing_day_last_arrival", (q) =>
      q
        .eq("VesselAbbrev", vesselAbbrev)
        .eq("SailingDay", sailingDay)
        .eq("IsLastArrivalOfSailingDay", true)
    )
    .unique();

/**
 * Loads one actual boundary event by key.
 *
 * @param ctx - Convex query context
 * @param key - Stable boundary-event key
 * @returns Matching document, or `null`
 */
const loadActualBoundaryEventByKey = async (ctx: QueryCtx, key: string) =>
  await ctx.db
    .query("eventsActual")
    .withIndex("by_key", (q) => q.eq("Key", key))
    .unique();

/**
 * Loads one predicted boundary event by key.
 *
 * @param ctx - Convex query context
 * @param key - Stable boundary-event key
 * @returns Matching document, or `null`
 */
const loadPredictedBoundaryEventByKey = async (ctx: QueryCtx, key: string) =>
  await ctx.db
    .query("eventsPredicted")
    .withIndex("by_key", (q) => q.eq("Key", key))
    .unique();

/**
 * Adds whole days to a sailing-day string without drifting service boundaries.
 *
 * @param sailingDay - Sailing day in YYYY-MM-DD format
 * @param days - Whole-day delta
 * @returns Shifted sailing day string
 */
const addDays = (sailingDay: string, days: number) => {
  const [year, month, day] = sailingDay.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return getSailingDay(date);
};
