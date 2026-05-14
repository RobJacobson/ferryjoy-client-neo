/**
 * Orchestrates one sailing-day dock-event reload payload end to end.
 *
 * Sequences trip-context preparation, schedule seed resolution, boundary event
 * hydration, and the scheduled and actual row builders so the reload mutation
 * receives one coherent payload. The function is intentionally thin: each stage
 * lives in its own module and is composed here once per sailing day.
 */

import { buildActualRows } from "./buildActualRows";
import { buildReloadBoundaryEvents } from "./buildReloadBoundaryEvents";
import { buildReloadTripContext } from "./buildReloadTripContext";
import { buildScheduledRows } from "./buildScheduledRows";
import { resolveDirectSeedSegments } from "./resolveDirectSeedSegments";
import type { ComputeDockEventsReloadArgs, DockEventsReload } from "./types";

/**
 * Builds the dock-events reload payload for one sailing day.
 *
 * The reload has two durable outputs: scheduled rows replace the static
 * sailing-day timetable, and actual rows replace observed boundaries while
 * preserving physical-only trip rows that cannot be tied to schedule. This
 * function keeps that whole transform in one place so each input is read once
 * and the mutation layer only persists the finished payload.
 *
 * @param args - Reload input bundle whose fields are documented individually below
 * @param args.sailingDay - Target sailing day label for rows and filtering
 * @param args.scheduleSegments - WSF scheduled segments for one sailing day
 * @param args.historyRecords - WSF vessel history rows using epoch milliseconds
 * @param args.vessels - Vessel identities for adapter resolution
 * @param args.terminals - Terminal identities for adapter resolution
 * @param args.activeTrips - Active Convex trip rows contributing actual evidence
 * @param args.completedTrips - Completed Convex trip rows contributing actual evidence
 * @param args.vesselLocations - Latest vessel location pings stripped for reload
 * @param args.updatedAt - Monotonic stamp applied to produced scheduled and actual rows
 * @returns Scheduled rows, actual rows, and TripKeys to preserve during replace
 */
const computeDockEventsReload = (
  args: ComputeDockEventsReloadArgs
): DockEventsReload => {
  const tripContext = buildReloadTripContext(
    args.activeTrips,
    args.completedTrips
  );
  const seedSegments = resolveDirectSeedSegments(
    args.scheduleSegments,
    args.vessels,
    args.terminals
  );
  const boundaryEvents = buildReloadBoundaryEvents({
    seedSegments,
    historyRecords: args.historyRecords,
    vessels: args.vessels,
    terminals: args.terminals,
  });
  const scheduledRows = buildScheduledRows(boundaryEvents, args.updatedAt);
  const actualRows = buildActualRows({
    sailingDay: args.sailingDay,
    boundaryEvents,
    vesselLocations: args.vesselLocations,
    updatedAt: args.updatedAt,
    tripContext,
  });

  return {
    sailingDay: args.sailingDay,
    scheduledRows,
    actualRows,
    physicalOnlyTripKeysToPreserve: tripContext.physicalOnlyTripKeysToPreserve,
  };
};

export { computeDockEventsReload };
