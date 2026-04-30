/**
 * Path B schedule resolution for new active trips after vessel arrival.
 */

import type { ConvexInferredScheduledSegment } from "domain/events/scheduled/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import type { UpdateVesselTripDbAccess } from "../types";
import { tryResolveScheduledSegmentFromNextTripKey } from "./resolveSegmentFromNextTripKey";
import { tryResolveScheduledSegmentFromScheduleTables } from "./resolveSegmentFromScheduleLookup";
import type { ResolvedCurrentTripFields, ResolvedTripScheduleFields } from "./types";

export type ResolveScheduleFromTripArrivalInput = {
  location: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip | undefined;
  scheduleAccess: UpdateVesselTripDbAccess;
};

/**
 * Resolves Path B trip schedule fields on a rollover/new-trip ping.
 *
 * Resolution order is strict:
 * 1) prior-row `NextScheduleKey` continuity (`nextTripKey`)
 * 2) schedule-table lookup across current/next service day (`scheduleLookup`)
 *
 * @param input - Ping context, prior active row, and schedule DB access
 * @returns Resolved current fields and optional next-leg fields for merge layer;
 *   undefined when no schedule evidence is available
 */
export const resolveScheduleFromTripArrival = async ({
  location,
  existingTrip,
  scheduleAccess,
}: ResolveScheduleFromTripArrivalInput): Promise<
  ResolvedTripScheduleFields | undefined
> => {
  const segmentFromNextTripKey = await tryResolveScheduledSegmentFromNextTripKey({
    nextScheduleKey: existingTrip?.NextScheduleKey,
    departingTerminalAbbrev: location.DepartingTerminalAbbrev,
    scheduleAccess,
  });
  if (segmentFromNextTripKey) {
    return resolutionFromSegment(segmentFromNextTripKey, "nextTripKey");
  }

  const segmentFromScheduleTables =
    await tryResolveScheduledSegmentFromScheduleTables({
      location,
      scheduleAccess,
    });
  if (segmentFromScheduleTables) {
    return resolutionFromSegment(segmentFromScheduleTables, "scheduleLookup");
  }

  return undefined;
};

/**
 * Maps one resolved segment into current and next schedule field shapes.
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
