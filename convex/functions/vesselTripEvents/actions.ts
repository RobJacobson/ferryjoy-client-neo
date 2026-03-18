import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { action, internalAction } from "_generated/server";
import { v } from "convex/values";
import {
  fetchAndTransformScheduledTrips,
} from "../../domain/scheduledTrips/fetchAndTransform";
import { buildSeedVesselTripEventsFromRawSegments } from "../../domain/vesselTripEvents";
import { getSailingDay } from "../../shared/time";

const logPrefix = "[SYNC VESSEL TRIP EVENTS]";
type VesselTripEventSeedResult = {
  Deleted: number;
  Inserted: number;
};

type VesselTripEventPurgeResult = {
  deleted: number;
};

/**
 * Manual seed for the current sailing day.
 */
export const syncVesselTripEventsManual = action({
  args: {},
  handler: async (ctx): Promise<VesselTripEventSeedResult> => {
    const sailingDay = getSailingDay(new Date());
    return await syncVesselTripEventsForDate(ctx, sailingDay);
  },
});

/**
 * Manual seed for a specific sailing day.
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
    daysProcessed: {
      sailingDay: string;
      inserted: number;
      deleted: number;
    }[];
  }> => {
    const startDate = getSailingDay(new Date());
    const daysToSync = args.daysToSync || 2;
    const daysProcessed: {
      sailingDay: string;
      inserted: number;
      deleted: number;
    }[] = [];

    let totalInserted = 0;
    let totalDeleted = 0;

    for (let i = 0; i < daysToSync; i++) {
      const currentDate = addDays(startDate, i);
      const result = await syncVesselTripEventsForDate(ctx, currentDate);
      totalInserted += result.Inserted;
      totalDeleted += result.Deleted;
      daysProcessed.push({
        sailingDay: currentDate,
        inserted: result.Inserted,
        deleted: result.Deleted,
      });
    }

    return {
      totalInserted,
      totalDeleted,
      daysProcessed,
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

const syncVesselTripEventsForDate = async (
  ctx: ActionCtx,
  targetDate: string
): Promise<VesselTripEventSeedResult> => {
  console.log(`${logPrefix} Starting seed for ${targetDate}`);

  const { routes, routeData } = await fetchAndTransformScheduledTrips(targetDate);
  console.log(
    `${logPrefix}Found ${routes.length} routes for ${targetDate}`
  );

  const directEvents = buildSeedVesselTripEventsFromRawSegments(
    routeData.flatMap((data) => data.segments)
  );

  const result = await ctx.runMutation(
    internal.functions.vesselTripEvents.mutations.replaceForSailingDay,
    {
      SailingDay: targetDate,
      Events: directEvents,
    }
  );

  console.log(
    `${logPrefix} Seed completed for ${targetDate}: ${directEvents.length} events`
  );

  return result;
};

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

const addDays = (dateString: string, days: number): string => {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return getSailingDay(date);
};
