/**
 * Resolves a new-trip schedule from scheduled dock-event tables.
 *
 * This resolver owns the schedule-table fallback. It loads current and next
 * service-day dock-event pools, finds the next departure from the current
 * terminal, and maps that inferred segment into vessel-trip schedule fields.
 */

import {
  findNextDepartureEvent,
  inferScheduledSegmentFromDepartureEvent,
} from "domain/events/scheduled/scheduledSegmentResolvers";
import type { ConvexInferredScheduledSegment } from "domain/events/scheduled/schemas";
import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { UpdateVesselTripDbAccess } from "../types";
import { mapScheduledSegmentToTripScheduleResolution } from "./mapScheduledSegmentToTripScheduleResolution";
import type { ResolvedTripScheduleFields } from "./types";

type ResolveScheduleFromScheduledTripsDbInput = {
  location: ConvexVesselLocation;
  dbAccess: UpdateVesselTripDbAccess;
};

/**
 * Resolves schedule fields from scheduled trips stored in the database.
 *
 * @param input - Current ping and schedule read access
 * @returns Resolved schedule fields for the next matching departure, otherwise undefined
 */
const resolveScheduleFromScheduledTripsDb = async ({
  location,
  dbAccess,
}: ResolveScheduleFromScheduledTripsDbInput): Promise<
  ResolvedTripScheduleFields | undefined
> => {
  const serviceDayPools = await dbAccess.getScheduleRolloverDockEvents({
    vesselAbbrev: location.VesselAbbrev,
    timestamp: location.TimeStamp,
  });

  const segment =
    segmentAfterDepartureInPool(
      serviceDayPools.currentDayEvents,
      location.DepartingTerminalAbbrev,
      location.TimeStamp
    ) ??
    segmentAfterDepartureInPool(
      serviceDayPools.nextDayEvents,
      location.DepartingTerminalAbbrev,
      Number.NEGATIVE_INFINITY
    );

  return segment === null
    ? undefined
    : mapScheduledSegmentToTripScheduleResolution(segment, "scheduleLookup");
};

/**
 * Selects the next departure event in one pool and infers its segment.
 *
 * The pool is cloned before resolver calls because the scheduled-event helpers
 * may consume array state while deriving the current and following segment.
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

export { resolveScheduleFromScheduledTripsDb };
