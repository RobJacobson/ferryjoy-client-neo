/**
 * Single-day dock-event reload action helper.
 *
 * Owns adapter fetches, epoch millisecond mapping for hydrate inputs, and the
 * unified reseed internal mutation.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { fetchAndTransformScheduledTrips } from "adapters";
import type { RawWsfScheduleSegment } from "adapters/fetch/fetchWsfScheduledTripsTypes";
import { buildHydratedDockBoundaryEventsForReload } from "domain/events/reload";
import { loadTerminalIdentities } from "functions/terminals/actions";
import { loadVesselIdentities } from "functions/vessels/actions";
import { dateToEpochMs, optionalDateToEpochMs } from "shared/convertDates";
import { stripConvexMeta } from "shared/stripConvexMeta";
import { fetchVesselHistoriesByVesselAndDates } from "ws-dottie/wsf-vessels/core";
import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";
import type {
  ConvexReloadDockHistoryRecord,
  ConvexReloadDockScheduleSegment,
} from "./reloadDockPayload";

type EventReloadResult = {
  ScheduledCount: number;
  ActualCount: number;
};

const LOG_PREFIX = "[RELOAD DOCK EVENTS]";

/**
 * Fetches vessel-history rows for vessels in a schedule slice.
 *
 * Exported for focused tests that mock the history API seam.
 *
 * @param scheduleSegments - Schedule segments whose VesselName fields identify vessels
 * @param targetDate - YYYY-MM-DD sailing day passed to the history API
 * @returns Concatenated history rows across requested vessels
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

  const batches = await Promise.all(
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

  return batches.flat();
};

const toConvexReloadDockScheduleSegment = (
  segment: RawWsfScheduleSegment
): ConvexReloadDockScheduleSegment => ({
  VesselName: segment.VesselName,
  DepartingTerminalID: segment.DepartingTerminalID,
  ArrivingTerminalID: segment.ArrivingTerminalID,
  DepartingTerminalName: segment.DepartingTerminalName,
  ArrivingTerminalName: segment.ArrivingTerminalName,
  DepartingTime: dateToEpochMs(segment.DepartingTime),
  ArrivingTime: optionalDateToEpochMs(segment.ArrivingTime),
  SailingNotes: segment.SailingNotes,
  Annotations: segment.Annotations,
  RouteID: segment.RouteID,
  RouteAbbrev: segment.RouteAbbrev,
  SailingDay: segment.SailingDay,
});

const toConvexReloadDockHistoryRecord = (
  record: VesselHistory
): ConvexReloadDockHistoryRecord => ({
  VesselId: record.VesselId,
  Vessel: record.Vessel ?? undefined,
  Departing: record.Departing ?? undefined,
  Arriving: record.Arriving ?? undefined,
  ScheduledDepart: optionalDateToEpochMs(record.ScheduledDepart),
  ActualDepart: optionalDateToEpochMs(record.ActualDepart),
  EstArrival: optionalDateToEpochMs(record.EstArrival),
});

/**
 * Reloads scheduled and actual dock events for one sailing day.
 *
 * @param ctx - Convex action context used for fetches and internal mutations
 * @param targetDate - Sailing day YYYY-MM-DD string
 * @returns Scheduled and actual row counts from the unified reseed mutation
 */
const runReloadDockEventsForSailingDay = async (
  ctx: ActionCtx,
  targetDate: string
): Promise<EventReloadResult> => {
  console.log(`${LOG_PREFIX} Starting reload for ${targetDate}`);

  const vessels = await loadVesselIdentities(ctx);
  const terminals = await loadTerminalIdentities(ctx);
  const { routeData } = await fetchAndTransformScheduledTrips(
    targetDate,
    vessels,
    terminals
  );
  const scheduleSegments = routeData.flatMap((data) => data.segments);
  const historyRecords = await fetchHistoryRecordsForDate(
    scheduleSegments,
    targetDate
  );
  const numericSegments = scheduleSegments.map(
    toConvexReloadDockScheduleSegment
  );
  const numericHistory = historyRecords.map(toConvexReloadDockHistoryRecord);
  const events = buildHydratedDockBoundaryEventsForReload({
    scheduleSegments: numericSegments,
    historyRecords: numericHistory,
    vessels: vessels.map(stripConvexMeta),
    terminals: terminals.map(stripConvexMeta),
  });

  const result = await ctx.runMutation(
    internal.functions.events.sync.mutations.reseedDockEventsForSailingDay,
    {
      SailingDay: targetDate,
      Events: events,
    }
  );

  return {
    ScheduledCount: result.ScheduledCount,
    ActualCount: result.ActualCount,
  };
};

export type { EventReloadResult };
export { fetchHistoryRecordsForDate, runReloadDockEventsForSailingDay };
