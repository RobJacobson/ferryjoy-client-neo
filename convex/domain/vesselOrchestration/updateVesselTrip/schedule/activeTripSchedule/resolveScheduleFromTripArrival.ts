/**
 * Path B schedule resolution for new active trips after vessel arrival.
 *
 * This module packages the ordered next-key and schedule-table strategies so
 * tests and secondary callers can reuse the same continuity logic as
 * `scheduleForActiveTrip` without duplicating fallback ordering. It returns a
 * merge-ready resolution when evidence exists, or `undefined` when neither
 * strategy resolves a segment (callers may warn or no-op).
 */

import type { ConvexInferredScheduledSegment } from "domain/events/scheduled/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import type { UpdateVesselTripDbAccess } from "../../types";
import { tryResolveScheduledSegmentFromNextTripKey } from "./resolveSegmentFromNextTripKey";
import { tryResolveScheduledSegmentFromScheduleTables } from "./resolveSegmentFromScheduleLookup";
import type {
  ResolvedCurrentTripFields,
  ResolvedTripScheduleFields,
} from "./types";

export type ResolveScheduleFromTripArrivalInput = {
  location: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip | undefined;
  dbAccess: UpdateVesselTripDbAccess;
};

/**
 * Resolves Path B trip schedule fields on a rollover/new-trip ping.
 *
 * This coordinator runs the same strict fallback chain as new-trip schedule
 * enrichment: keyed continuity first, then schedule-table inference. It keeps
 * schedule reads targeted and avoids synthesizing fields when no segment is
 * found, so merge layers and orchestration can treat `undefined` as an explicit
 * unresolved outcome.
 *
 * Resolution order is strict:
 * 1) prior-row `NextScheduleKey` continuity (`nextTripKey`)
 * 2) schedule-table lookup across current/next service day (`scheduleLookup`)
 *
 * @param input - Ping context, prior active row, and {@link UpdateVesselTripDbAccess}
 * @returns Resolved current fields and optional next-leg fields for merge layer;
 *   undefined when no schedule evidence is available
 */
export const resolveScheduleFromTripArrival = async ({
  location,
  existingTrip,
  dbAccess,
}: ResolveScheduleFromTripArrivalInput): Promise<
  ResolvedTripScheduleFields | undefined
> => {
  // Prefer prior-row next-key continuity so schedule identity stays stable when linkage is valid.
  const segmentFromNextTripKey =
    await tryResolveScheduledSegmentFromNextTripKey({
      nextScheduleKey: existingTrip?.NextScheduleKey,
      departingTerminalAbbrev: location.DepartingTerminalAbbrev,
      dbAccess,
    });
  if (segmentFromNextTripKey) {
    return resolutionFromSegment(segmentFromNextTripKey, "nextTripKey");
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
 * Maps one resolved segment into current and next schedule field shapes.
 *
 * This adapter translates schedule-segment vocabulary (`DepartingTime`, `Key`,
 * `NextKey`) into vessel-trip-facing names expected by schedule enrichment.
 * It preserves current-leg identity and next-leg hints together so downstream
 * merge logic can attach `NextScheduleKey` consistently with `ScheduleKey`.
 *
 * @param segment - Scheduled segment selected by one Path B strategy
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
