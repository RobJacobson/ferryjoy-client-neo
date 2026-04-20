/**
 * Wires schedule snapshot lookups into trip builders and {@link VesselTripsBuildTripAdapters}.
 */

import { inferScheduledSegmentFromDepartureEvent } from "domain/timelineRows/scheduledSegmentResolvers";
import { createScheduledSegmentLookupFromSnapshot } from "domain/vesselOrchestration/shared";
import { resolveEffectiveDockedLocation } from "domain/vesselOrchestration/updateVesselTrips/continuity/resolveEffectiveDockedLocation";
import type { RunUpdateVesselTripsInput } from "domain/vesselOrchestration/updateVesselTrips/contracts";
import { buildCompletedTrip } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildCompletedTrip";
import { buildTripCore } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildTrip";
import { detectTripEvents } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/detectTripEvents";
import type { VesselTripsBuildTripAdapters } from "domain/vesselOrchestration/updateVesselTrips/vesselTripsBuildTripAdapters";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import type { EffectiveTripIdentity } from "shared/effectiveTripIdentity";

/** Snapshot-backed lookup used by the trip tick (same type as `createScheduledSegmentLookupFromSnapshot`). */
export type ScheduleSegmentLookup = ReturnType<
  typeof createScheduledSegmentLookupFromSnapshot
>;

/** Per-tick builders and schedule hooks for {@link runUpdateVesselTrips}. */
export type TripPipelineDeps = {
  buildCompletedTrip: typeof buildCompletedTrip;
  buildTripCore: typeof buildTripCore;
  buildTripAdapters: VesselTripsBuildTripAdapters;
  detectTripEvents: typeof detectTripEvents;
};

/**
 * Builds lookup tables and adapters from `scheduleContext` for one pipeline run.
 */
export const createTripPipelineDeps = (
  input: Pick<RunUpdateVesselTripsInput, "scheduleContext">
): TripPipelineDeps => {
  const lookup = createScheduledSegmentLookupFromSnapshot(
    input.scheduleContext
  );

  return {
    buildCompletedTrip,
    buildTripCore,
    buildTripAdapters: createScheduleTripAdapters(lookup),
    detectTripEvents,
  };
};

/**
 * Schedule continuity adapters for one snapshot lookup (plain object, not curried).
 */
export const createScheduleTripAdapters = (
  lookup: ScheduleSegmentLookup
): VesselTripsBuildTripAdapters => ({
  resolveEffectiveLocation: (location, existingTrip) =>
    resolveEffectiveLocationForLookup(lookup, location, existingTrip),
  appendFinalSchedule: (baseTrip, existingTrip) =>
    appendFinalScheduleForLookup(lookup, baseTrip, existingTrip),
});

const appendFinalScheduleForLookup = (
  lookup: ScheduleSegmentLookup,
  baseTrip: ConvexVesselTrip,
  existingTrip: ConvexVesselTrip | undefined
): ConvexVesselTrip => {
  const segmentKey = baseTrip.ScheduleKey;
  if (!segmentKey) {
    return baseTrip;
  }

  const carriedSchedule =
    existingTrip?.ScheduleKey === segmentKey
      ? {
          NextScheduleKey:
            baseTrip.NextScheduleKey ?? existingTrip.NextScheduleKey,
          NextScheduledDeparture:
            baseTrip.NextScheduledDeparture ??
            existingTrip.NextScheduledDeparture,
        }
      : undefined;

  if (carriedSchedule) {
    return {
      ...baseTrip,
      ...carriedSchedule,
    };
  }

  const scheduledEvent =
    lookup.getScheduledDepartureEventBySegmentKey(segmentKey);
  if (!scheduledEvent) {
    return {
      ...baseTrip,
      ScheduleKey: baseTrip.ScheduleKey,
      NextScheduleKey: baseTrip.NextScheduleKey,
      NextScheduledDeparture: baseTrip.NextScheduledDeparture,
    };
  }

  const sameDayEvents = lookup.getScheduledDockEventsForSailingDay({
    vesselAbbrev: scheduledEvent.VesselAbbrev,
    sailingDay: scheduledEvent.SailingDay,
  });
  const scheduledSegment = inferScheduledSegmentFromDepartureEvent(
    scheduledEvent,
    sameDayEvents
  );

  return {
    ...baseTrip,
    ScheduleKey: scheduledSegment.Key ?? baseTrip.ScheduleKey,
    NextScheduleKey: scheduledSegment.NextKey ?? baseTrip.NextScheduleKey,
    NextScheduledDeparture:
      scheduledSegment.NextDepartingTime ?? baseTrip.NextScheduledDeparture,
  };
};

const resolveEffectiveLocationForLookup = (
  lookup: ScheduleSegmentLookup,
  location: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip | undefined
): ConvexVesselLocation => {
  if (!location.AtDock || location.LeftDock !== undefined) {
    return location;
  }

  const result = resolveEffectiveDockedLocation(
    lookup,
    location,
    existingTrip
  );

  logDockedIdentityResolution({
    location,
    existingTrip,
    stableDockedIdentity: result.stableDockedIdentity,
    scheduledSegmentKey: result.scheduledResolution?.segment.Key,
    effectiveIdentity: result.effectiveIdentity,
    effectiveLocation: result.effectiveLocation,
  });

  return result.effectiveLocation;
};

const logDockedIdentityResolution = ({
  location,
  existingTrip,
  stableDockedIdentity,
  scheduledSegmentKey,
  effectiveIdentity,
  effectiveLocation,
}: {
  location: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip | undefined;
  stableDockedIdentity: boolean;
  scheduledSegmentKey: string | undefined;
  effectiveIdentity: EffectiveTripIdentity;
  effectiveLocation: ConvexVesselLocation;
}): void => {
  const changedFromExisting =
    existingTrip?.ScheduleKey !== effectiveLocation.ScheduleKey ||
    existingTrip?.ScheduledDeparture !== effectiveLocation.ScheduledDeparture ||
    existingTrip?.ArrivingTerminalAbbrev !==
      effectiveLocation.ArrivingTerminalAbbrev;
  const changedFromLive =
    location.ScheduleKey !== effectiveLocation.ScheduleKey ||
    location.ScheduledDeparture !== effectiveLocation.ScheduledDeparture ||
    location.ArrivingTerminalAbbrev !==
      effectiveLocation.ArrivingTerminalAbbrev;
  const suspiciousState =
    effectiveIdentity.source === "rollover_schedule" ||
    effectiveIdentity.conflictsLiveFeed;

  if (!changedFromExisting && !changedFromLive && !suspiciousState) {
    return;
  }

  console.warn(
    `[VesselTrips][DockedIdentity] ${JSON.stringify({
      vesselAbbrev: location.VesselAbbrev,
      at: new Date(location.TimeStamp).toISOString(),
      stableDockedIdentity,
      effectiveIdentitySource: effectiveIdentity.source,
      conflictsLiveFeed: effectiveIdentity.conflictsLiveFeed,
      scheduledSegmentKey,
      changedFromExisting,
      changedFromLive,
    })}`
  );
};
