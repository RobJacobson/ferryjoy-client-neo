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
  dbAccess: UpdateVesselTripDbAccess;
};

/**
 * Attempts schedule-segment inference from schedule tables.
 *
 * This helper is the second continuity strategy after next-key resolution.
 * It loads current/next service-day dock-event pools for the vessel context,
 * then searches for the earliest matching departure from the vessel's terminal
 * at or after the ping timestamp. This allows schedule recovery during WSF
 * realtime gaps immediately after dock arrivals and trip transitions.
 *
 * @param input - Ping context and {@link UpdateVesselTripDbAccess} for current/next
 *   service-day schedule-table lookup
 * @returns Inferred segment for the next departure from current terminal, or null
 */
export const tryResolveScheduledSegmentFromScheduleTables = async ({
  location,
  dbAccess,
}: ResolveSegmentFromScheduleTablesInput): Promise<ConvexInferredScheduledSegment | null> => {
  // Load both service-day pools so lookup can cross midnight/service-day boundaries safely.
  const serviceDayPools = await dbAccess.getScheduleRolloverDockEvents({
    vesselAbbrev: location.VesselAbbrev,
    timestamp: location.TimeStamp,
  });

  return (
    // Prefer same-day departures first to keep continuity anchored to the current operating context.
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
 * This helper isolates one-pool departure matching so callers can compose
 * current-day and next-day fallbacks without duplicating event-scan logic.
 * It clones the pool before resolver calls to preserve caller-owned arrays,
 * then converts the matched departure into the inferred segment shape used by
 * schedule enrichment and continuity merge.
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
  // Clone the pool so downstream resolvers can consume array state without mutating caller inputs.
  const pool = [...events];

  // Find the first eligible departure for this terminal/time bound to anchor inference deterministically.
  const departure = findNextDepartureEvent(pool, {
    terminalAbbrev: departingTerminalAbbrev,
    afterTime,
  });

  // Infer the full segment from the departure event so current/next schedule fields stay aligned.
  return departure
    ? inferScheduledSegmentFromDepartureEvent(departure, pool)
    : null;
};
