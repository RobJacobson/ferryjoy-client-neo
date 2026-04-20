import { createScheduledSegmentLookupFromSnapshot } from "domain/vesselOrchestration/shared";
import { inferScheduledSegmentFromDepartureEvent } from "domain/timelineRows/scheduledSegmentResolvers";
import type { RunUpdateVesselTripsInput } from "domain/vesselOrchestration/updateVesselTrips/contracts";
import { resolveEffectiveDockedLocation } from "domain/vesselOrchestration/updateVesselTrips/continuity/resolveEffectiveDockedLocation";
import { buildCompletedTrip } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildCompletedTrip";
import { buildTripCore } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/buildTrip";
import { detectTripEvents } from "domain/vesselOrchestration/updateVesselTrips/tripLifecycle/detectTripEvents";
import type { VesselTripsBuildTripAdapters } from "domain/vesselOrchestration/updateVesselTrips/vesselTripsBuildTripAdapters";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import type { EffectiveTripIdentity } from "shared/effectiveTripIdentity";

export type TripUpdateRuntime = {
  buildCompletedTrip: typeof buildCompletedTrip;
  buildTripCore: typeof buildTripCore;
  buildTripAdapters: VesselTripsBuildTripAdapters;
  detectTripEvents: typeof detectTripEvents;
};

export const createTripUpdateRuntime = (
  input: Pick<RunUpdateVesselTripsInput, "scheduleContext">
): TripUpdateRuntime => {
  const lookup = createScheduledSegmentLookupFromSnapshot(input.scheduleContext);

  return {
    buildCompletedTrip,
    buildTripCore,
    buildTripAdapters: {
      resolveEffectiveLocation: buildResolveEffectiveLocation(lookup),
      appendFinalSchedule: buildAppendFinalSchedule(lookup),
    },
    detectTripEvents,
  };
};

export const buildAppendFinalSchedule =
  (lookup: ReturnType<typeof createScheduledSegmentLookupFromSnapshot>) =>
  async (
    baseTrip: ConvexVesselTrip,
    existingTrip: ConvexVesselTrip | undefined
  ): Promise<ConvexVesselTrip> => {
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

export const buildResolveEffectiveLocation =
  (lookup: ReturnType<typeof createScheduledSegmentLookupFromSnapshot>) =>
  async (
    location: ConvexVesselLocation,
    existingTrip: ConvexVesselTrip | undefined
  ): Promise<ConvexVesselLocation> => {
    if (!location.AtDock || location.LeftDock !== undefined) {
      return location;
    }

    const result = await resolveEffectiveDockedLocation(
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
