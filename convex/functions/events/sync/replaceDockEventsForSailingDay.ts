/**
 * Mutation glue that turns a Convex reload payload into persisted event rows.
 *
 * The internal reload mutation hands this helper validated schedule and
 * history slices in epoch-ms shape; the helper restores Date instants, loads
 * the identity, trip, and live-location context required for live-actual
 * reconciliation, composes hydrated dock transitions, and finally persists
 * scheduled and actual rows. Keeping the flow linear here makes the
 * action-to-mutation seam explicit and easier to reason about than the prior
 * split that hydrated history twice across the boundary.
 *
 * vesselLocations uses a full-table collect: the live location snapshot is one
 * row per fleet vessel and stays tiny; reconcile already filters by sailing day
 * and vessel when pairing samples to boundaries.
 */

import type { MutationCtx } from "_generated/server";
import {
  buildDockEventRowsForSailingDayReload,
  buildHydratedTransitionsFromReloadInputs,
} from "domain/events";
import { replaceActualRowsForSailingDay } from "functions/events/eventsActual/mutations";
import { upsertScheduledRowsForSailingDay } from "functions/events/eventsScheduled/mutations";
import { stripConvexMeta } from "shared/stripConvexMeta";
import { loadTripIndexesForSailingDay } from "./loadTripIndexesForSailingDay";
import { mapConvexReloadDockDataToRawFetchShapes } from "./mapConvexReloadDockDataToRawFetchShapes";
import type { ConvexReloadDockData } from "./reloadDockDataSchemas";

type ReplaceDockEventsForSailingDayRowsArgs = {
  ReloadDockData: ConvexReloadDockData;
};

/**
 * Replaces scheduled and actual event-table rows for one sailing day reload.
 *
 * Restores Date-shaped fetch payloads, loads vessel and terminal identity
 * rows plus trip indexes and live vessel locations, composes hydrated dock
 * transitions from schedule plus history, then delegates row construction to
 * buildDockEventRowsForSailingDayReload. Persistence routes scheduled rows
 * through bulk upsert and actual rows through the grandfather-aware replace
 * helper so ping-only actuals survive a reload.
 *
 * @param ctx - Convex mutation context with database access
 * @param args.ReloadDockData - Validated reload payload built by the action layer
 * @returns ScheduledCount and ActualCount reflecting rows produced for operators
 */
const replaceDockEventsForSailingDayRows = async (
  ctx: MutationCtx,
  args: ReplaceDockEventsForSailingDayRowsArgs
) => {
  const updatedAt = Date.now();
  const sailingDay = args.ReloadDockData.SailingDay;

  const { scheduleSegments, historyRecords } =
    mapConvexReloadDockDataToRawFetchShapes(args.ReloadDockData);

  const [vessels, terminals] = await Promise.all([
    ctx.db.query("vesselsIdentity").collect(),
    ctx.db.query("terminalsIdentity").collect(),
  ]);

  const hydratedTransitions = buildHydratedTransitionsFromReloadInputs({
    scheduleSegments,
    historyRecords,
    vessels: vessels.map(stripConvexMeta),
    terminals: terminals.map(stripConvexMeta),
  });

  const { tripBySegmentKey, activeTripsByVesselAbbrev, physicalOnlyTrips } =
    await loadTripIndexesForSailingDay(ctx, sailingDay);

  const vesselLocations = (await ctx.db.query("vesselLocations").collect()).map(
    stripConvexMeta
  );

  const { scheduledRows, actualRows, scheduledCount, actualCount } =
    buildDockEventRowsForSailingDayReload({
      sailingDay,
      events: hydratedTransitions,
      updatedAt,
      tripBySegmentKey,
      activeTripsByVesselAbbrev,
      physicalOnlyTrips,
      vesselLocations,
    });

  await upsertScheduledRowsForSailingDay(ctx, sailingDay, scheduledRows);

  await replaceActualRowsForSailingDay(ctx, sailingDay, actualRows);

  return {
    ScheduledCount: scheduledCount,
    ActualCount: actualCount,
  };
};

export { replaceDockEventsForSailingDayRows };
