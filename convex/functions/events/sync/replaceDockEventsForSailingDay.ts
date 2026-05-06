/**
 * Mutation glue that turns Convex reload payloads into persisted event rows.
 *
 * Scheduled and actual reload helpers intentionally persist their own table
 * slices separately. Actual reloads may use schedule rows as transient context,
 * but they do not replace scheduled rows or delete physical observations.
 *
 * vesselLocations uses a full-table collect: the live location snapshot is one
 * row per fleet vessel and stays tiny; reconcile already filters by sailing day
 * and vessel when pairing samples to boundaries.
 */

import type { MutationCtx } from "_generated/server";
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
import type {
  ConvexReloadDockData,
  ConvexReloadDockScheduleData,
} from "./reloadDockDataSchemas";

type ReplaceScheduledDockEventsForSailingDayRowsArgs = {
  ReloadDockScheduleData: ConvexReloadDockScheduleData;
};

type ReloadActualDockEventsForSailingDayRowsArgs = {
  ReloadDockData: ConvexReloadDockData;
};

/**
 * Replaces scheduled event-table rows for one sailing day reload.
 *
 * Loads vessel and terminal identity rows, builds schedule-derived dock
 * boundaries from the numeric reload payload, and reconciles only the
 * eventsScheduled day slice.
 *
 * @param ctx - Convex mutation context with database access
 * @param args.ReloadDockScheduleData - Validated schedule reload payload
 * @returns ScheduledCount reflecting rows produced for operators
 */
const replaceScheduledDockEventsForSailingDayRows = async (
  ctx: MutationCtx,
  args: ReplaceScheduledDockEventsForSailingDayRowsArgs
) => {
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
 * Upserts actual event-table rows for one sailing day reload.
 *
 * Loads identity, trip, and live-location context, composes hydrated dock
 * transitions from schedule plus history, builds physical actual rows, and
 * upserts those observations by EventKey without deleting omitted rows.
 *
 * @param ctx - Convex mutation context with database access
 * @param args.ReloadDockData - Validated reload payload built by the action layer
 * @returns ActualCount reflecting rows produced for operators
 */
const reloadActualDockEventsForSailingDayRows = async (
  ctx: MutationCtx,
  args: ReloadActualDockEventsForSailingDayRowsArgs
) => {
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

/**
 * Runs the legacy combined reload helper by composing the split table helpers.
 *
 * This preserves internal callers while the action layer migrates to the
 * table-specific mutations. The scheduled and actual writes still run through
 * separate helpers and keep their independent persistence policy.
 *
 * @param ctx - Convex mutation context with database access
 * @param args.ReloadDockData - Validated reload payload built by the action layer
 * @returns ScheduledCount and ActualCount reflecting rows produced for operators
 */
const replaceDockEventsForSailingDayRows = async (
  ctx: MutationCtx,
  args: ReloadActualDockEventsForSailingDayRowsArgs
) => {
  const scheduled = await replaceScheduledDockEventsForSailingDayRows(ctx, {
    ReloadDockScheduleData: {
      SailingDay: args.ReloadDockData.SailingDay,
      ScheduleSegments: args.ReloadDockData.ScheduleSegments,
    },
  });
  const actual = await reloadActualDockEventsForSailingDayRows(ctx, args);

  return {
    ScheduledCount: scheduled.ScheduledCount,
    ActualCount: actual.ActualCount,
  };
};

export {
  reloadActualDockEventsForSailingDayRows,
  replaceDockEventsForSailingDayRows,
  replaceScheduledDockEventsForSailingDayRows,
};
