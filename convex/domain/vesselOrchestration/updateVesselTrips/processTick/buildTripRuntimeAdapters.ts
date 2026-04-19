/**
 * Runtime-backed trip adapter builders for vessel tick processing.
 *
 * This module keeps lifecycle behavior in domain while allowing Convex runtime
 * ownership to stay in the functions layer via injected lookup callbacks.
 */

import { inferScheduledSegmentFromDepartureEvent } from "domain/timelineRows/scheduledSegmentResolvers";
import type { ScheduledSegmentLookup } from "domain/vesselOrchestration/updateVesselTrips/continuity/resolveDockedScheduledSegment";
import { resolveEffectiveDockedLocation } from "domain/vesselOrchestration/updateVesselTrips/continuity/resolveEffectiveDockedLocation";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTripWithPredictions } from "functions/vesselTrips/schemas";
import type { EffectiveTripIdentity } from "shared/effectiveTripIdentity";
import type { VesselTripsBuildTripAdapters } from "../vesselTripsBuildTripAdapters";

/**
 * Build schedule and effective-location adapters for `buildTrip`.
 *
 * @param lookup - Schedule segment lookup callbacks owned by functions-layer wiring
 * @returns Adapter bag consumed by vessel trip lifecycle helpers
 */
export const createBuildTripRuntimeAdapters = (
  lookup: ScheduledSegmentLookup
): VesselTripsBuildTripAdapters => ({
  resolveEffectiveLocation: buildResolveEffectiveLocation(lookup),
  appendFinalSchedule: buildAppendFinalSchedule(lookup),
});

/**
 * Build schedule enrichment for one trip proposal using injected lookups.
 *
 * @param lookup - Schedule segment lookup callbacks
 * @returns Schedule enricher used by lifecycle trip building
 */
export const buildAppendFinalSchedule =
  (lookup: ScheduledSegmentLookup) =>
  async (
    baseTrip: ConvexVesselTripWithPredictions,
    existingTrip: ConvexVesselTripWithPredictions | undefined
  ): Promise<ConvexVesselTripWithPredictions> => {
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

/**
 * Build effective-location resolution for docked locations.
 *
 * @param lookup - Schedule segment lookup callbacks
 * @returns Effective location resolver used by lifecycle trip building
 */
export const buildResolveEffectiveLocation =
  (lookup: ScheduledSegmentLookup) =>
  async (
    location: ConvexVesselLocation,
    existingTrip: ConvexVesselTripWithPredictions | undefined
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

/**
 * Emit warnings when docked identity resolution overrides feed identity.
 *
 * @param args - Inputs and computed effective location context
 * @returns Nothing; writes warnings for observability
 */
const logDockedIdentityResolution = ({
  location,
  existingTrip,
  stableDockedIdentity,
  scheduledSegmentKey,
  effectiveIdentity,
  effectiveLocation,
}: {
  location: ConvexVesselLocation;
  existingTrip: ConvexVesselTripWithPredictions | undefined;
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
