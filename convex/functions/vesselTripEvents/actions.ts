/**
 * Defines manual and scheduled Convex actions for building and resetting the
 * `vesselTripEvents` read model.
 */
import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { action, internalAction } from "_generated/server";
import { v } from "convex/values";
import { fetchVesselHistoriesByVesselAndDates } from "ws-dottie/wsf-vessels/core";
import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";
import { fetchAndTransformScheduledTrips } from "../../domain/scheduledTrips/fetchAndTransform";
import {
  buildSeedVesselTripEventsFromRawSegments,
  mergeSeededEventsWithHistory,
} from "../../domain/vesselTimeline/events";
import type { RawWsfScheduleSegment } from "../../shared/fetchWsfScheduleData";
import { getPacificTimeComponents, getSailingDay } from "../../shared/time";

const logPrefix = "[SYNC VESSEL TRIP EVENTS]";
type VesselTripEventSeedResult = {
  Deleted: number;
  Inserted: number;
};

type VesselTripEventPurgeResult = {
  deleted: number;
};

type WindowSyncDayResult = {
  sailingDay: string;
  inserted: number;
  deleted: number;
};

/**
 * Manual schedule sync for the current sailing day.
 *
 * This is replace-only in the normalized boundary-event architecture.
 */
export const syncVesselTripEventsManual = action({
  args: {},
  handler: async (ctx): Promise<VesselTripEventSeedResult> => {
    const sailingDay = getSailingDay(new Date());
    return await syncVesselTripEventsForDate(ctx, sailingDay);
  },
});

/**
 * Manual schedule sync for a specific sailing day.
 *
 * This is replace-only in the normalized boundary-event architecture.
 */
export const syncVesselTripEventsForDateManual = action({
  args: {
    targetDate: v.string(),
  },
  handler: async (ctx, args): Promise<VesselTripEventSeedResult> => {
    return await syncVesselTripEventsForDate(ctx, args.targetDate);
  },
});

/**
 * Backward-compatible alias for the current sailing day schedule sync.
 */
export const resetVesselTripEventsManual = action({
  args: {},
  handler: async (ctx): Promise<VesselTripEventSeedResult> => {
    const sailingDay = getSailingDay(new Date());
    return await syncVesselTripEventsForDate(ctx, sailingDay);
  },
});

/**
 * Backward-compatible alias for a specific sailing day schedule sync.
 */
export const resetVesselTripEventsForDateManual = action({
  args: {
    targetDate: v.string(),
  },
  handler: async (ctx, args): Promise<VesselTripEventSeedResult> => {
    return await syncVesselTripEventsForDate(ctx, args.targetDate);
  },
});

/**
 * Internal windowed seed for automated vesselTripEvents schedule hydration.
 */
export const syncVesselTripEventsWindowed = internalAction({
  args: { daysToSync: v.optional(v.number()) },
  handler: async (
    ctx,
    args
  ): Promise<{
    totalInserted: number;
    totalDeleted: number;
    daysProcessed: WindowSyncDayResult[];
  }> => {
    return await syncWindowedVesselTripEvents(ctx, args.daysToSync);
  },
});

/**
 * Internal boundary-safe daily seed for vesselTripEvents.
 *
 * Convex crons run in UTC, so DST makes a single cron expression unreliable
 * for "3:00 AM Pacific". Call this from multiple UTC cron slots and run only
 * when the current Pacific local hour is actually 3.
 */
export const syncVesselTripEventsAtSailingDayBoundary = internalAction({
  args: { daysToSync: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const pacificNow = getPacificTimeComponents(new Date());

    if (pacificNow.hour !== 3) {
      return {
        skipped: true,
        reason: "outside_pacific_3am_window",
        totalInserted: 0,
        totalDeleted: 0,
        daysProcessed: [] as WindowSyncDayResult[],
      };
    }

    return {
      skipped: false,
      ...(await syncWindowedVesselTripEvents(ctx, args.daysToSync)),
    };
  },
});

/**
 * Deletes every row in the vesselTripEvents table.
 */
export const purgeVesselTripEventsManual = action({
  args: {},
  handler: async (ctx): Promise<VesselTripEventPurgeResult> => {
    return await purgeVesselTripEvents(ctx);
  },
});

/**
 * Runs the vessel-trip-event sync for one sailing day.
 *
 * @param ctx - Convex action context
 * @param targetDate - Sailing day to sync
 * @returns Insert/delete counts from the underlying mutation
 */
const syncVesselTripEventsForDate = async (
  ctx: ActionCtx,
  targetDate: string
): Promise<VesselTripEventSeedResult> => {
  console.log(`${logPrefix} Starting replace sync for ${targetDate}`);

  const { routeData } = await fetchAndTransformScheduledTrips(targetDate);
  const scheduleSegments = routeData.flatMap((data) => data.segments);
  console.log(
    `${logPrefix} Found ${scheduleSegments.length} schedule segments for ${targetDate}`
  );

  const directEvents =
    buildSeedVesselTripEventsFromRawSegments(scheduleSegments);
  const historyRecords = await fetchHistoryRecordsForDate(
    scheduleSegments,
    targetDate
  );
  const hydratedEvents = mergeSeededEventsWithHistory({
    sailingDay: targetDate,
    seededEvents: directEvents,
    existingEvents: [],
    scheduleSegments,
    historyRecords,
  });

  const result = await ctx.runMutation(
    internal.functions.vesselTripEvents.mutations.replaceForSailingDay,
    {
      SailingDay: targetDate,
      Events: hydratedEvents,
    }
  );

  console.log(
    `${logPrefix} replace sync completed for ${targetDate}: ${hydratedEvents.length} events`
  );

  return result;
};

/**
 * Deletes the entire `vesselTripEvents` table in batches.
 *
 * @param ctx - Convex action context
 * @returns Total deleted row count
 */
const purgeVesselTripEvents = async (
  ctx: ActionCtx
): Promise<VesselTripEventPurgeResult> => {
  let totalDeleted = 0;
  const batchSize = 500;

  while (true) {
    const result = await ctx.runMutation(
      internal.functions.vesselTripEvents.mutations.deleteVesselTripEventsBatch,
      {
        limit: batchSize,
      }
    );

    totalDeleted += result.deleted;

    if (!result.hasMore) {
      break;
    }
  }

  console.log(`${logPrefix} Purged ${totalDeleted} vessel trip events`);

  return {
    deleted: totalDeleted,
  };
};

/**
 * Runs replace-only schedule sync for the current sailing day window.
 *
 * @param ctx - Convex action context
 * @param daysToSyncOverride - Optional number of sailing days to process
 * @returns Aggregate sync counts and the per-day results
 */
const syncWindowedVesselTripEvents = async (
  ctx: ActionCtx,
  daysToSyncOverride?: number
): Promise<{
  totalInserted: number;
  totalDeleted: number;
  daysProcessed: WindowSyncDayResult[];
}> => {
  const startDate = getSailingDay(new Date());
  const daysToSync = daysToSyncOverride ?? 2;
  const daysProcessed: WindowSyncDayResult[] = [];

  let totalInserted = 0;
  let totalDeleted = 0;

  for (let i = 0; i < daysToSync; i++) {
    const sailingDay = addDays(startDate, i);
    const result = await syncVesselTripEventsForDate(ctx, sailingDay);

    totalInserted += result.Inserted;
    totalDeleted += result.Deleted;
    daysProcessed.push({
      sailingDay,
      inserted: result.Inserted,
      deleted: result.Deleted,
    });
  }

  return {
    totalInserted,
    totalDeleted,
    daysProcessed,
  };
};

/**
 * Fetches vessel history records for the scheduled vessels on one sailing day.
 *
 * @param scheduleSegments - Schedule segments used to derive vessel names
 * @param targetDate - Sailing day to request from WSF history
 * @returns Flattened vessel history rows for the requested vessel/day set
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
 * Adds whole sailing days to a `YYYY-MM-DD` service-day string.
 *
 * @param dateString - Base sailing day string in Pacific service-day format
 * @param days - Number of days to add
 * @returns Shifted sailing day string
 */
const addDays = (dateString: string, days: number): string => {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return getSailingDay(date);
};
