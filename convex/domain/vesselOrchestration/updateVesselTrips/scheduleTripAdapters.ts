/**
 * Schedule lookup helpers for one trip-update ping: effective docked location
 * and final schedule leg attachment, using {@link ScheduledSegmentTables}.
 */

import {
  type ScheduledSegmentTables,
} from "domain/vesselOrchestration/shared";
import { resolveEffectiveDockedLocation } from "domain/vesselOrchestration/updateVesselTrips/continuity/resolveEffectiveDockedLocation";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import type { EffectiveTripIdentity } from "shared/effectiveTripIdentity";

/**
 * Adjusts a docked live sample to a consistent schedule identity when the feed
 * omits or contradicts `ScheduleKey` / terminals.
 *
 * Non-docked pings and pings that already carry `LeftDock` pass through unchanged.
 *
 * @param tables - Snapshot-backed segment index for this ping
 * @param location - Current vessel location (docked-at-terminal branch handled here)
 * @param existingTrip - Prior active trip row for continuity, if any
 * @returns Location fields aligned with the chosen effective identity
 */
export const resolveEffectiveLocationForLookup = (
  tables: ScheduledSegmentTables,
  location: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip | undefined
): ConvexVesselLocation => {
  if (!location.AtDock || location.LeftDock !== undefined) {
    return location;
  }

  const result = resolveEffectiveDockedLocation(tables, location, existingTrip);

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
 * Fills `NextScheduleKey` / `NextScheduledDeparture` from the lookup or from
 * the prior row when the current segment key matches.
 *
 * @param tables - Snapshot-backed segment index for this ping
 * @param baseTrip - Trip after base derivation (typically has `ScheduleKey`)
 * @param existingTrip - Prior row for same-vessel carry-forward of next-leg fields
 * @returns Trip with next-leg schedule fields set when derivable
 */
export const appendFinalScheduleForLookup = (
  tables: ScheduledSegmentTables,
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

  // Infer next leg from today’s scheduled departure row + same-day events.
  const scheduledSegment = tables.scheduledDepartureBySegmentKey[segmentKey];
  if (!scheduledSegment) {
    return {
      ...baseTrip,
      ScheduleKey: baseTrip.ScheduleKey,
      NextScheduleKey: baseTrip.NextScheduleKey,
      NextScheduledDeparture: baseTrip.NextScheduledDeparture,
    };
  }

  return {
    ...baseTrip,
    ScheduleKey: scheduledSegment.Key ?? baseTrip.ScheduleKey,
    NextScheduleKey: scheduledSegment.NextKey ?? baseTrip.NextScheduleKey,
    NextScheduledDeparture:
      scheduledSegment.NextDepartingTime ?? baseTrip.NextScheduledDeparture,
  };
};

/**
 * Warns when effective docked identity diverges from feed or stored trip, or
 * when schedule rollover conflicts with live fields (observability only).
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
