/**
 * Schedule-segment inference from scheduled dock-event tables.
 */

import type {
  ConvexInferredScheduledSegment,
  ConvexScheduledDockEvent,
} from "domain/events/scheduled/schemas";
import {
  findNextDepartureEvent,
  inferScheduledSegmentFromDepartureEvent,
} from "domain/timelineRows/scheduledSegmentResolvers";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { UpdateVesselTripDbAccess } from "../types";

type ResolveSegmentFromScheduleTablesInput = {
  location: ConvexVesselLocation;
  scheduleAccess: UpdateVesselTripDbAccess;
};

/**
 * Attempts schedule-segment inference from schedule tables.
 *
 * @param input - Ping context and schedule DB access for current/next service-day
 *   schedule-table lookup
 * @returns Inferred segment for the next departure from current terminal, or null
 */
export const tryResolveScheduledSegmentFromScheduleTables = async ({
  location,
  scheduleAccess,
}: ResolveSegmentFromScheduleTablesInput): Promise<ConvexInferredScheduledSegment | null> => {
  const serviceDayPools = await scheduleAccess.getScheduleRolloverDockEvents({
    vesselAbbrev: location.VesselAbbrev,
    timestamp: location.TimeStamp,
  });

  return (
    segmentAfterDepartureInPool(
      serviceDayPools.currentDayEvents,
      location.DepartingTerminalAbbrev,
      location.TimeStamp
    ) ??
    // Scan the next service-day pool from its earliest departure.
    segmentAfterDepartureInPool(
      serviceDayPools.nextDayEvents,
      location.DepartingTerminalAbbrev,
      Number.NEGATIVE_INFINITY
    )
  );
};

/**
 * Selects the next departure event in one pool and infers its segment.
 *
 * @param events - Scheduled dock-event rows for one sailing-day pool
 * @param departingTerminalAbbrev - Terminal filter for departure matching
 * @param afterTime - Lower bound for departure search in this pool
 * @returns Inferred segment for the first matching departure, or null
 */
const segmentAfterDepartureInPool = (
  events: ReadonlyArray<ConvexScheduledDockEvent>,
  departingTerminalAbbrev: string | undefined,
  afterTime: number
): ConvexInferredScheduledSegment | null => {
  const pool = [...events];
  const departure = findNextDepartureEvent(pool, {
    terminalAbbrev: departingTerminalAbbrev,
    afterTime,
  });
  return departure
    ? inferScheduledSegmentFromDepartureEvent(departure, pool)
    : null;
};
