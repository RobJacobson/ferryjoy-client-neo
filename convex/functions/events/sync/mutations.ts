/**
 * Internal mutations for static dock-event reload persistence.
 *
 * Scheduled and actual reloads persist through their table-owned helpers.
 * Static reload keeps the table writes split so scheduled and actual refreshes
 * remain independently callable and no predicted rows are touched.
 */

import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import {
  buildActualDockRowsForSailingDayReload,
  hydrateActualTransitionsFromReloadInputs,
} from "domain/events/actual";
import {
  buildScheduledDockEventRecords,
  buildScheduledDockEvents,
} from "domain/events/scheduled";
import { upsertActualDockRows } from "functions/events/eventsActual/mutations";
import { upsertScheduledRowsForSailingDay } from "functions/events/eventsScheduled/mutations";
import { stripConvexMeta } from "shared/stripConvexMeta";
import { loadTripIndexesForSailingDay } from "./loadTripIndexesForSailingDay";
import {
  type ConvexReloadDockData,
  type ConvexReloadDockScheduleData,
  reloadDockDataSchema,
  reloadDockScheduleDataSchema,
} from "./reloadDockDataSchemas";

type ReplaceScheduledDockEventsForSailingDayRowsArgs = {
  ReloadDockScheduleData: ConvexReloadDockScheduleData;
};

type ReloadActualDockEventsForSailingDayRowsArgs = {
  ReloadDockData: ConvexReloadDockData;
};

/**
 * Replaces scheduled dock-event rows for one sailing day.
 *
 * @param ctx - Convex mutation context
 * @param args.ReloadDockScheduleData - Schedule reload payload
 * @returns Count of scheduled rows produced for the day
 */
const replaceScheduledDockEventsForSailingDayRows = async (
  ctx: Parameters<typeof upsertScheduledRowsForSailingDay>[0],
  args: ReplaceScheduledDockEventsForSailingDayRowsArgs
): Promise<{ ScheduledCount: number }> => {
  const updatedAt = Date.now();
  const sailingDay = args.ReloadDockScheduleData.SailingDay;
  const [vessels, terminals] = await Promise.all([
    ctx.db.query("vesselsIdentity").collect(),
    ctx.db.query("terminalsIdentity").collect(),
  ]);
  const scheduledTransitions = buildScheduledDockEventRecords(
    args.ReloadDockScheduleData.ScheduleSegments,
    vessels.map(stripConvexMeta),
    terminals.map(stripConvexMeta)
  );
  const scheduledRows = buildScheduledDockEvents(
    scheduledTransitions,
    updatedAt
  );

  await upsertScheduledRowsForSailingDay(ctx, sailingDay, scheduledRows);

  return {
    ScheduledCount: scheduledRows.length,
  };
};

/**
 * Upserts actual dock-event rows for one sailing day.
 *
 * @param ctx - Convex mutation context
 * @param args.ReloadDockData - Schedule, history, and sailing-day reload payload
 * @returns Count of actual rows produced for the day
 */
const reloadActualDockEventsForSailingDayRows = async (
  ctx: Parameters<typeof upsertActualDockRows>[0],
  args: ReloadActualDockEventsForSailingDayRowsArgs
): Promise<{ ActualCount: number }> => {
  const updatedAt = Date.now();
  const sailingDay = args.ReloadDockData.SailingDay;
  const [vessels, terminals] = await Promise.all([
    ctx.db.query("vesselsIdentity").collect(),
    ctx.db.query("terminalsIdentity").collect(),
  ]);
  const hydratedTransitions = hydrateActualTransitionsFromReloadInputs({
    scheduleSegments: args.ReloadDockData.ScheduleSegments,
    historyRecords: args.ReloadDockData.HistoryRecords,
    vessels: vessels.map(stripConvexMeta),
    terminals: terminals.map(stripConvexMeta),
  });
  const { tripBySegmentKey, activeTripsByVesselAbbrev, physicalOnlyTrips } =
    await loadTripIndexesForSailingDay(ctx, sailingDay);
  const vesselLocations = (await ctx.db.query("vesselLocations").collect()).map(
    stripConvexMeta
  );
  const { actualRows, actualCount } = buildActualDockRowsForSailingDayReload({
    sailingDay,
    events: hydratedTransitions,
    updatedAt,
    tripBySegmentKey,
    activeTripsByVesselAbbrev,
    physicalOnlyTrips,
    vesselLocations,
  });

  await upsertActualDockRows(ctx, actualRows);

  return {
    ActualCount: actualCount,
  };
};

const replaceScheduledDockEventsForSailingDay = internalMutation({
  args: { ReloadDockScheduleData: reloadDockScheduleDataSchema },
  returns: v.object({ ScheduledCount: v.number() }),
  handler: async (ctx, args) =>
    await replaceScheduledDockEventsForSailingDayRows(ctx, args),
});

const reloadActualDockEventsForSailingDay = internalMutation({
  args: { ReloadDockData: reloadDockDataSchema },
  returns: v.object({ ActualCount: v.number() }),
  handler: async (ctx, args) =>
    await reloadActualDockEventsForSailingDayRows(ctx, args),
});

export {
  reloadActualDockEventsForSailingDay,
  reloadActualDockEventsForSailingDayRows,
  replaceScheduledDockEventsForSailingDay,
  replaceScheduledDockEventsForSailingDayRows,
};
