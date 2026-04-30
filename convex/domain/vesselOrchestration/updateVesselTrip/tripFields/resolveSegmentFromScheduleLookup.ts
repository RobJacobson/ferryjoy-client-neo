/**
 * Schedule-segment inference from rollover dock-event lookups.
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

type ResolveSegmentFromScheduleLookupInput = {
  location: ConvexVesselLocation;
  scheduleAccess: UpdateVesselTripDbAccess;
};

/**
 * Attempts schedule-segment inference from rollover dock-event pools.
 *
 * @param input - Ping context and schedule DB access for rollover lookup
 * @returns Inferred segment for the next departure from current terminal, or null
 */
export const tryResolveScheduledSegmentFromScheduleLookup = async ({
  location,
  scheduleAccess,
}: ResolveSegmentFromScheduleLookupInput): Promise<ConvexInferredScheduledSegment | null> => {
  const rollover = await scheduleAccess.getScheduleRolloverDockEvents({
    vesselAbbrev: location.VesselAbbrev,
    timestamp: location.TimeStamp,
  });

  return (
    segmentAfterDepartureInPool(
      rollover.currentDayEvents,
      location.DepartingTerminalAbbrev,
      location.TimeStamp
    ) ??
    // Scan the next sailing-day pool from its earliest departure.
    segmentAfterDepartureInPool(
      rollover.nextDayEvents,
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
