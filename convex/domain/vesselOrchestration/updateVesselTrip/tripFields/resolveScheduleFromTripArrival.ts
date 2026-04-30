/**
 * Path B schedule resolution for new active trips after vessel arrival.
 */

import type { ConvexInferredScheduledSegment } from "domain/events/scheduled/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { deriveTripIdentity } from "shared/tripIdentity";
import type { UpdateVesselTripDbAccess } from "../types";
import { tryResolveScheduledSegmentFromNextTripKey } from "./resolveSegmentFromNextTripKey";
import { tryResolveScheduledSegmentFromScheduleLookup } from "./resolveSegmentFromScheduleLookup";
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
 * 2) rollover schedule lookup (`scheduleLookup`)
 * 3) degraded ping-only fallback (`scheduleUnavailable`)
 *
 * @param input - Ping context, prior active row, and schedule DB access
 * @returns Resolved current fields and optional next-leg fields for merge layer
 */
export const resolveScheduleFromTripArrival = async ({
  location,
  existingTrip,
  scheduleAccess,
}: ResolveScheduleFromTripArrivalInput): Promise<ResolvedTripScheduleFields> => {
  const segmentFromNextKey = await tryResolveScheduledSegmentFromNextTripKey({
    nextScheduleKey: existingTrip?.NextScheduleKey,
    departingTerminalAbbrev: location.DepartingTerminalAbbrev,
    scheduleAccess,
  });
  if (segmentFromNextKey) {
    return resolutionFromSegment(segmentFromNextKey, "nextTripKey");
  }

  const segmentFromScheduleLookup =
    await tryResolveScheduledSegmentFromScheduleLookup({
      location,
      scheduleAccess,
    });
  if (segmentFromScheduleLookup) {
    return resolutionFromSegment(segmentFromScheduleLookup, "scheduleLookup");
  }

  console.warn("[TripFields] schedule inference unavailable", {
    vesselAbbrev: location.VesselAbbrev,
    departingTerminalAbbrev: location.DepartingTerminalAbbrev,
    timeStamp: location.TimeStamp,
    existingScheduleKey: existingTrip?.ScheduleKey,
    existingNextScheduleKey: existingTrip?.NextScheduleKey,
  });
  return {
    current: resolveDegradedCurrentTripFieldsFromPing(location),
  };
};

/**
 * Builds degraded current-trip fields from ping-only schedule evidence.
 *
 * @param location - Raw ping when no schedule segment can be resolved
 * @returns Inferred current fields tagged as unavailable schedule evidence
 */
const resolveDegradedCurrentTripFieldsFromPing = (
  location: ConvexVesselLocation
): ResolvedCurrentTripFields => {
  const arrivingTerminalAbbrev = location.ArrivingTerminalAbbrev;
  const scheduledDeparture = location.ScheduledDeparture;
  const identity = deriveTripIdentity({
    vesselAbbrev: location.VesselAbbrev,
    departingTerminalAbbrev: location.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev,
    scheduledDepartureMs: scheduledDeparture,
  });

  return {
    ArrivingTerminalAbbrev: arrivingTerminalAbbrev,
    ScheduledDeparture: scheduledDeparture,
    ScheduleKey: location.ScheduleKey ?? identity.ScheduleKey,
    SailingDay: identity.SailingDay,
    tripFieldDataSource: "inferred",
    tripFieldResolutionMethod: "scheduleUnavailable",
  };
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
    tripFieldDataSource: "inferred",
    tripFieldResolutionMethod: method,
  },
  next: {
    NextScheduleKey: segment.NextKey,
    NextScheduledDeparture: segment.NextDepartingTime,
  },
});
