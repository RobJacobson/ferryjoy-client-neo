/**
 * Single-sailing-day dock-event reload runner.
 *
 * Shared entry point for every public and internal reload action: gathers WSF
 * inputs and identity tables, then forwards a normalized payload to the
 * internal reseed mutation that owns trip reads and table persistence.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { fetchAndTransformScheduledTrips } from "adapters";
import type { RawWsfScheduleSegment } from "adapters/fetch/fetchWsfScheduledTripsTypes";
import type {
  ReloadDockDayCountResult,
  WsfVesselHistory,
} from "domain/events/reload/schemas";
import { loadTerminalIdentities } from "functions/terminals/actions";
import { loadVesselIdentities } from "functions/vessels/actions";
import { dateToEpochMs, optionalDateToEpochMs } from "shared/convertDates";
import { stripConvexMeta } from "shared/stripConvexMeta";
import { fetchVesselHistoriesByVesselAndDates } from "ws-dottie/wsf-vessels/core";
import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";

const LOG_PREFIX = "[RELOAD DOCK EVENTS]";

/**
 * Reloads scheduled and actual dock events for one sailing day.
 *
 * Pulls vessel and terminal identities, fetches WSF scheduled trips and
 * vessel history, then hands the consolidated inputs to the internal reseed
 * mutation so the action stays a thin fetch-and-forward layer. The runner is
 * shared by every public and internal action wrapper so all entry points use
 * the same fetch, transform, and persist pipeline.
 *
 * @param ctx - Convex action context used for fetches and internal mutations
 * @param targetDate - Sailing day YYYY-MM-DD string
 * @returns Scheduled and actual row counts from the unified reseed mutation
 */
const runReloadDockEventsForSailingDay = async (
  ctx: ActionCtx,
  targetDate: string
): Promise<ReloadDockDayCountResult> => {
  console.log(`${LOG_PREFIX} Starting reload for ${targetDate}`);

  // Load identity tables once so adapter resolvers share consistent mappings.
  const vessels = await loadVesselIdentities(ctx);
  const terminals = await loadTerminalIdentities(ctx);

  // Fetch WSF scheduled trips for the target day and flatten across routes.
  const { routeData } = await fetchAndTransformScheduledTrips(
    targetDate,
    vessels,
    terminals
  );
  const adapterScheduleSegments = routeData.flatMap((data) => data.segments);

  // Fetch vessel history and convert all times to epoch ms for the mutation.
  const { scheduledSegments, historyRecords } = await fetchReloadWsfInputs(
    adapterScheduleSegments,
    targetDate
  );

  // Forward to the internal mutation that owns trip reads and persistence.
  return await ctx.runMutation(
    internal.functions.events.reload.mutations
      .reseedDockStatusEventsForSailingDay,
    {
      SailingDay: targetDate,
      ScheduleSegments: scheduledSegments,
      HistoryRecords: historyRecords,
      Vessels: vessels.map(stripConvexMeta),
      Terminals: terminals.map(stripConvexMeta),
    }
  );
};

/**
 * Fetches vessel history and maps WSF rows into mutation-safe epoch-ms shapes.
 *
 * Reload mutations cannot accept Date objects across the action-to-mutation
 * boundary, so the action performs that conversion beside the WSF fetch it
 * already owns. The returned payload is the exact external input shape the
 * internal reseed mutation validates.
 *
 * @param segments - Raw schedule segments for the sailing day
 * @param targetDate - Sailing day YYYY-MM-DD string
 * @returns Scheduled segments and history rows using epoch-ms for times
 */
const fetchReloadWsfInputs = async (
  segments: RawWsfScheduleSegment[],
  targetDate: string
) => {
  const vesselNames = [
    ...new Set(
      segments
        .map((segment) => segment.VesselName?.trim())
        .filter((name): name is string => Boolean(name))
    ),
  ];
  const historyRows = (
    await Promise.all(
      vesselNames.map((vesselName) =>
        fetchVesselHistoriesByVesselAndDates({
          params: {
            VesselName: vesselName,
            DateStart: targetDate,
            DateEnd: targetDate,
          },
        })
      )
    )
  ).flat();

  return {
    scheduledSegments: segments.map((segment) => ({
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
      SailingDay: targetDate,
    })),
    historyRecords: historyRows.map(wsfVesselHistoryToConvexVesselHistory),
  };
};

/**
 * Maps one WSF vessel history row into the mutation reload input shape.
 *
 * @param record - Vessel history row from the WSF API with Date-valued times
 * @returns WsfVesselHistory with epoch-ms times
 */
const wsfVesselHistoryToConvexVesselHistory = (
  record: VesselHistory
): WsfVesselHistory => ({
  VesselId: record.VesselId,
  Vessel: record.Vessel ?? undefined,
  Departing: record.Departing ?? undefined,
  Arriving: record.Arriving ?? undefined,
  ScheduledDepart: optionalDateToEpochMs(record.ScheduledDepart),
  ActualDepart: optionalDateToEpochMs(record.ActualDepart),
  EstArrival: optionalDateToEpochMs(record.EstArrival),
});

export { runReloadDockEventsForSailingDay };
