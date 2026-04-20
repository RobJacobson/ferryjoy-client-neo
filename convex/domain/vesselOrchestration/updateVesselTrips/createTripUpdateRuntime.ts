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

/** Per-tick deps: core builders, event detector, and schedule continuity adapters. */
export type TripUpdateRuntime = {
  buildCompletedTrip: typeof buildCompletedTrip;
  buildTripCore: typeof buildTripCore;
  buildTripAdapters: VesselTripsBuildTripAdapters;
  detectTripEvents: typeof detectTripEvents;
};

/**
 * Builds lookup tables and adapters from `scheduleContext` for one pipeline run.
 *
 * @param input - Must include `scheduleContext` for segment resolution
 * @returns Runtime bundle passed into prepare/finalize/active stages
 */
export const createTripUpdateRuntime = (
  input: Pick<RunUpdateVesselTripsInput, "scheduleContext">
): TripUpdateRuntime => {
  const lookup = createScheduledSegmentLookupFromSnapshot(
    input.scheduleContext
  );

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

/**
 * Curried adapter: fills next-leg schedule fields from the snapshot when needed.
 *
 * @param lookup - Snapshot-backed scheduled departure/dock index
 * @returns Function that merges continuity onto `baseTrip` (async for API shape)
 */
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

    // Reuse next-leg hints when the active segment id matches the prior row.
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

    // Infer segment from the schedule backbone when the feed only has a segment key.
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

    // Same-sailing-day dock stream so inference can resolve next-leg context.
    const sameDayEvents = lookup.getScheduledDockEventsForSailingDay({
      vesselAbbrev: scheduledEvent.VesselAbbrev,
      sailingDay: scheduledEvent.SailingDay,
    });
    // Derive segment key + next departure fields from the backbone event list.
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
 * Curried adapter: resolves docked-at-terminal identity using schedule continuity.
 *
 * @param lookup - Snapshot-backed scheduled segment index
 * @returns Function that may rewrite location fields before base trip build
 */
export const buildResolveEffectiveLocation =
  (lookup: ReturnType<typeof createScheduledSegmentLookupFromSnapshot>) =>
  async (
    location: ConvexVesselLocation,
    existingTrip: ConvexVesselTrip | undefined
  ): Promise<ConvexVesselLocation> => {
    // Underway or already departed: feed fields are authoritative.
    if (!location.AtDock || location.LeftDock !== undefined) {
      return location;
    }

    // Docked: reconcile live feed vs persisted trip using schedule continuity rules.
    const result = await resolveEffectiveDockedLocation(
      lookup,
      location,
      existingTrip
    );

    // Warn when effective identity differs from feed/trip or looks rollover-related.
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
 * Emits a warning when effective dock identity diverges from feed or prior trip.
 *
 * @param location - Raw location for this tick
 * @param existingTrip - Prior active trip, if any
 * @param stableDockedIdentity - Whether feed and trip already agreed without schedule fixup
 * @param scheduledSegmentKey - Resolved segment key from continuity, if any
 * @param effectiveIdentity - Chosen identity source and conflict flags
 * @param effectiveLocation - Location after identity application
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
