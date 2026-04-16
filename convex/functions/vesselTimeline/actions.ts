/**
 * Actions for syncing normalized VesselTimeline boundary events.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { action, internalAction } from "_generated/server";
import {
  fetchAndTransformScheduledTrips,
  type RawWsfScheduleSegment,
} from "adapters/wsf/scheduledTrips";
import { v } from "convex/values";
import {
  buildSeedVesselTripEventsFromRawSegments,
  hydrateSeededEventsWithHistory,
} from "domain/timelineReseed";
import { fetchVesselHistoriesByVesselAndDates } from "ws-dottie/wsf-vessels/core";
import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";
import { getPacificTimeComponents, getSailingDay } from "../../shared/time";
import { loadBackendTerminals } from "../terminals/actions";
import { loadBackendVessels } from "../vessels/actions";

const logPrefix = "[SYNC VESSEL TIMELINE]";

type TimelineSyncResult = {
  ScheduledCount: number;
  ActualCount: number;
};

type WindowSyncDayResult = {
  sailingDay: string;
  scheduledCount: number;
  actualCount: number;
};

/**
 * Manually reseed the current sailing day's vessel timeline rows.
 *
 * @param ctx - Convex public action context
 * @returns Scheduled and actual row counts written for today
 */
export const syncVesselTimelineManual = action({
  args: {},
  handler: async (ctx): Promise<TimelineSyncResult> => {
    const sailingDay = getSailingDay(new Date());
    return await reseedVesselTimelineForDate(ctx, sailingDay);
  },
});

/**
 * Manually reseed vessel timeline rows for a specific sailing day.
 *
 * @param ctx - Convex public action context
 * @param args - Action arguments containing the target sailing day
 * @returns Scheduled and actual row counts written for the requested date
 */
export const syncVesselTimelineForDateManual = action({
  args: {
    targetDate: v.string(),
  },
  handler: async (ctx, args): Promise<TimelineSyncResult> =>
    await reseedVesselTimelineForDate(ctx, args.targetDate),
});

/**
 * Reseed a sliding window of sailing days for timeline recovery or backfill.
 *
 * @param ctx - Convex internal action context
 * @param args - Action arguments containing an optional day-count override
 * @returns Aggregate scheduled and actual row counts for the processed window
 */
export const syncVesselTimelineWindowed = internalAction({
  args: { daysToSync: v.optional(v.number()) },
  handler: async (ctx, args) =>
    await syncWindowedVesselTimeline(ctx, args.daysToSync),
});

/**
 * Run the windowed reseed only during the Pacific 3am sailing-day boundary.
 *
 * @param ctx - Convex internal action context
 * @param args - Action arguments containing an optional day-count override
 * @returns Skip metadata or aggregate counts for the processed window
 */
export const syncVesselTimelineAtSailingDayBoundary = internalAction({
  args: { daysToSync: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const pacificNow = getPacificTimeComponents(new Date());

    if (pacificNow.hour !== 3) {
      return {
        skipped: true,
        reason: "outside_pacific_3am_window",
        totalScheduled: 0,
        totalActual: 0,
        daysProcessed: [] as WindowSyncDayResult[],
      };
    }

    return {
      skipped: false,
      ...(await syncWindowedVesselTimeline(ctx, args.daysToSync)),
    };
  },
});

/**
 * Rebuild scheduled and actual vessel timeline rows for one sailing day.
 *
 * @param ctx - Convex action context
 * @param targetDate - Sailing day in YYYY-MM-DD format
 * @returns Scheduled and actual row counts written for the date
 */
const reseedVesselTimelineForDate = async (
  ctx: ActionCtx,
  targetDate: string
): Promise<TimelineSyncResult> => {
  console.log(`${logPrefix} Starting reseed for ${targetDate}`);

  const vessels = await loadBackendVessels(ctx);
  const terminals = await loadBackendTerminals(ctx);
  const { routeData } = await fetchAndTransformScheduledTrips(
    targetDate,
    vessels,
    terminals
  );
  const scheduleSegments = routeData.flatMap((data) => data.segments);
  console.log(
    `${logPrefix} Found ${scheduleSegments.length} schedule segments for ${targetDate}`
  );

  const seededEvents = buildSeedVesselTripEventsFromRawSegments(
    scheduleSegments,
    vessels,
    terminals
  );
  const historyRecords = await fetchHistoryRecordsForDate(
    scheduleSegments,
    targetDate
  );
  const hydratedEvents = hydrateSeededEventsWithHistory({
    seededEvents,
    existingEvents: [],
    scheduleSegments,
    historyRecords,
    vessels,
    terminals,
  });

  const result = await ctx.runMutation(
    internal.functions.vesselTimeline.mutations
      .reseedBoundaryEventsForSailingDay,
    {
      SailingDay: targetDate,
      Events: hydratedEvents,
    }
  );

  console.log(
    `${logPrefix} reseed completed for ${targetDate}: ${result.ScheduledCount} scheduled rows`
  );

  return result;
};

/**
 * Reseed today and the following N-1 sailing days as one recovery window.
 *
 * @param ctx - Convex action context
 * @param daysToSyncOverride - Optional number of sailing days to reseed
 * @returns Aggregate counts plus per-day reseed summaries
 */
const syncWindowedVesselTimeline = async (
  ctx: ActionCtx,
  daysToSyncOverride?: number
) => {
  const startDate = getSailingDay(new Date());
  const daysToSync = daysToSyncOverride ?? 2;
  const daysProcessed: WindowSyncDayResult[] = [];
  let totalScheduled = 0;
  let totalActual = 0;

  for (let i = 0; i < daysToSync; i++) {
    const sailingDay = addDays(startDate, i);
    const result = await reseedVesselTimelineForDate(ctx, sailingDay);

    totalScheduled += result.ScheduledCount;
    totalActual += result.ActualCount;
    daysProcessed.push({
      sailingDay,
      scheduledCount: result.ScheduledCount,
      actualCount: result.ActualCount,
    });
  }

  return {
    totalScheduled,
    totalActual,
    daysProcessed,
  };
};

/**
 * Fetch historical vessel movement rows for the vessels referenced by the
 * scheduled segments on a sailing day.
 *
 * @param scheduleSegments - Scheduled segments used to derive vessel names
 * @param targetDate - Sailing day in YYYY-MM-DD format
 * @returns Flattened vessel history rows for the requested day
 */
const fetchHistoryRecordsForDate = async (
  scheduleSegments: RawWsfScheduleSegment[],
  targetDate: string
): Promise<VesselHistory[]> => {
  const vesselNames = Array.from(
    new Set(
      scheduleSegments
        .map((segment) => segment.VesselName?.trim())
        .filter((name): name is string => Boolean(name))
    )
  );

  const historyBatches = await Promise.all(
    vesselNames.map((vesselName) =>
      fetchVesselHistoriesByVesselAndDates({
        params: {
          VesselName: vesselName,
          DateStart: targetDate,
          DateEnd: targetDate,
        },
      })
    )
  );

  return historyBatches.flat();
};

/**
 * Add whole sailing days to a YYYY-MM-DD string using a noon-UTC anchor to
 * avoid timezone rollovers.
 *
 * @param dateString - Base sailing day in YYYY-MM-DD format
 * @param days - Number of days to offset, positive or negative
 * @returns Shifted sailing day string in YYYY-MM-DD format
 */
const addDays = (dateString: string, days: number): string => {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return getSailingDay(date);
};
