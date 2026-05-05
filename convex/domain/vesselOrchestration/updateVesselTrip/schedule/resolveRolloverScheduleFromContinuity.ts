/**
 * Resolves inferred schedules for new active trips from continuity evidence.
 *
 * This module packages the ordered next-key and schedule-table strategies so
 * active-trip schedule application does not duplicate fallback ordering. It
 * returns a merge-ready resolution when evidence exists, or undefined when
 * neither strategy resolves a segment.
 */

import {
  findNextDepartureEvent,
  inferScheduledSegmentFromDepartureEvent,
} from "domain/events/scheduled/scheduledSegmentResolvers";
import type { ConvexInferredScheduledSegment } from "domain/events/scheduled/schemas";
import type { ConvexScheduledDockEvent } from "functions/events/eventsScheduled/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import type { UpdateVesselTripDbAccess } from "../types";
import type {
  ResolvedCurrentTripFields,
  ResolvedTripScheduleFields,
} from "./types";

type ResolveRolloverScheduleFromContinuityInput = {
  location: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip | undefined;
  dbAccess: UpdateVesselTripDbAccess;
};

type ResolveSegmentFromNextScheduleKeyInput = {
  nextScheduleKey: string | undefined;
  departingTerminalAbbrev: string | undefined;
  dbAccess: UpdateVesselTripDbAccess;
};

type ResolveSegmentFromScheduleTablesInput = {
  location: ConvexVesselLocation;
  dbAccess: UpdateVesselTripDbAccess;
};

/**
 * Resolves trip schedule fields on a rollover/new-trip ping.
 *
 * This coordinator runs the same strict fallback chain as new-trip schedule
 * enrichment: keyed continuity first, then schedule-table inference. It keeps
 * schedule reads targeted and avoids synthesizing fields when no segment is
 * found, so merge layers and orchestration can treat undefined as an explicit
 * unresolved outcome.
 *
 * Resolution order is strict:
 * 1) prior-row NextScheduleKey continuity through nextScheduleKey
 * 2) schedule-table lookup across current/next service day through scheduleLookup
 *
 * @param input - Ping context, prior active row, and schedule read access
 * @returns Resolved current fields and optional next-leg fields for merge layer;
 *   undefined when no schedule evidence is available
 */
const resolveRolloverScheduleFromContinuity = async ({
  location,
  existingTrip,
  dbAccess,
}: ResolveRolloverScheduleFromContinuityInput): Promise<
  ResolvedTripScheduleFields | undefined
> => {
  // Prefer prior-row next-key continuity so schedule identity stays stable when linkage is valid.
  const segmentFromNextScheduleKey =
    await tryResolveScheduledSegmentFromNextScheduleKey({
      nextScheduleKey: existingTrip?.NextScheduleKey,
      departingTerminalAbbrev: location.DepartingTerminalAbbrev,
      dbAccess,
    });
  if (segmentFromNextScheduleKey) {
    return resolutionFromSegment(segmentFromNextScheduleKey, "nextScheduleKey");
  }

  // Fall back to schedule tables when keyed resolution fails so dock-arrival gaps still recover a leg.
  const segmentFromScheduleTables =
    await tryResolveScheduledSegmentFromScheduleTables({
      location,
      dbAccess,
    });
  if (segmentFromScheduleTables) {
    return resolutionFromSegment(segmentFromScheduleTables, "scheduleLookup");
  }

  // Signal unresolved schedule evidence so callers can no-op or log without inventing weak fields.
  return undefined;
};

/**
 * Attempts keyed segment resolution from the prior active row's next schedule key.
 *
 * The keyed strategy is the first rollover recovery path because it preserves
 * explicit schedule continuity. The current departing terminal is still checked
 * so a stale next key cannot attach the replacement row to the wrong leg.
 *
 * @param input - Prior next key, current departing terminal, and schedule reads
 * @returns Matching scheduled segment when continuity holds, otherwise null
 */
const tryResolveScheduledSegmentFromNextScheduleKey = async ({
  nextScheduleKey,
  departingTerminalAbbrev,
  dbAccess,
}: ResolveSegmentFromNextScheduleKeyInput): Promise<ConvexInferredScheduledSegment | null> => {
  if (nextScheduleKey === undefined) {
    return null;
  }

  const segment =
    await dbAccess.getScheduledSegmentByScheduleKey(nextScheduleKey);
  if (segment === null) {
    return null;
  }

  return segment.DepartingTerminalAbbrev === departingTerminalAbbrev
    ? segment
    : null;
};

/**
 * Attempts schedule-segment inference from schedule tables.
 *
 * The fallback loads current and next service-day dock-event pools, then finds
 * the next matching departure from the vessel's current terminal. This recovers
 * rollover identity when keyed continuity is missing or stale.
 *
 * @param input - Ping context and schedule access for dock-event lookup
 * @returns Inferred segment for the next departure from current terminal, or null
 */
const tryResolveScheduledSegmentFromScheduleTables = async ({
  location,
  dbAccess,
}: ResolveSegmentFromScheduleTablesInput): Promise<ConvexInferredScheduledSegment | null> => {
  const serviceDayPools = await dbAccess.getScheduleRolloverDockEvents({
    vesselAbbrev: location.VesselAbbrev,
    timestamp: location.TimeStamp,
  });

  return (
    segmentAfterDepartureInPool(
      serviceDayPools.currentDayEvents,
      location.DepartingTerminalAbbrev,
      location.TimeStamp
    ) ??
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

/**
 * Maps one resolved segment into current and next schedule field shapes.
 *
 * This adapter translates schedule-segment vocabulary into vessel-trip-facing
 * names expected by schedule enrichment.
 * It preserves current-leg identity and next-leg hints together so downstream
 * merge logic can attach NextScheduleKey consistently with ScheduleKey.
 *
 * @param segment - Scheduled segment selected by one rollover strategy
 * @param method - Resolution strategy used to obtain the segment
 * @returns Current and next schedule fields for downstream merge
 */
const resolutionFromSegment = (
  segment: ConvexInferredScheduledSegment,
  method: ResolvedCurrentTripFields["tripFieldResolutionMethod"]
): ResolvedTripScheduleFields => ({
  current: {
    ArrivingTerminalAbbrev: segment.ArrivingTerminalAbbrev,
    ScheduledDeparture: segment.DepartingTime,
    ScheduleKey: segment.Key,
    SailingDay: segment.SailingDay,
    tripFieldResolutionMethod: method,
  },
  next: {
    NextScheduleKey: segment.NextKey,
    NextScheduledDeparture: segment.NextDepartingTime,
  },
});

export type { ResolveRolloverScheduleFromContinuityInput };
export { resolveRolloverScheduleFromContinuity };
