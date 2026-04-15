/**
 * Normalize docked live locations into an effective trip identity for writes.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { resolveDockedScheduledSegment } from "domain/vesselTrips/continuity/resolveDockedScheduledSegment";
import { resolveEffectiveDockedLocation } from "domain/vesselTrips/continuity/resolveEffectiveDockedLocation";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import type { EffectiveTripIdentity } from "shared/effectiveTripIdentity";

/**
 * Resolve the effective location that downstream trip building should use.
 *
 * Raw `vesselLocations` stay feed-shaped, but the write pipeline can complete
 * transiently missing docked identity from the scheduled backbone.
 *
 * @param ctx - Convex action context for schedule lookups
 * @param location - Latest vessel location for this vessel
 * @param existingTrip - Active trip row when known
 * @returns Location with effective schedule identity applied when applicable
 */
export const resolveEffectiveLocation = async (
  ctx: ActionCtx,
  location: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip | undefined
): Promise<ConvexVesselLocation> => {
  if (!location.AtDock || location.LeftDock !== undefined) {
    return location;
  }

  const result = await resolveEffectiveDockedLocation(
    {
      getScheduledDepartureSegmentBySegmentKey: (segmentKey) =>
        ctx.runQuery(
          internal.functions.eventsScheduled.queries
            .getScheduledDepartureSegmentBySegmentKey,
          { segmentKey }
        ),
      getNextDepartureSegmentAfterDeparture: (args) =>
        ctx.runQuery(
          internal.functions.eventsScheduled.queries
            .getNextDepartureSegmentAfterDeparture,
          args
        ),
    },
    location,
    existingTrip
  );

  logDockedIdentityResolution({
    location,
    existingTrip,
    stableDockedIdentity: result.stableDockedIdentity,
    scheduledResolution: result.scheduledResolution,
    effectiveIdentity: result.effectiveIdentity,
    effectiveLocation: result.effectiveLocation,
  });

  return result.effectiveLocation;
};

const logDockedIdentityResolution = ({
  location,
  existingTrip,
  stableDockedIdentity,
  scheduledResolution,
  effectiveIdentity,
  effectiveLocation,
}: {
  location: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip | undefined;
  stableDockedIdentity: boolean;
  scheduledResolution: Awaited<
    ReturnType<typeof resolveDockedScheduledSegment>
  > | null;
  effectiveIdentity: EffectiveTripIdentity;
  effectiveLocation: ConvexVesselLocation;
}) => {
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
      timestamp: new Date(location.TimeStamp).toISOString(),
      stableDockedIdentity,
      effectiveIdentitySource: effectiveIdentity.source,
      conflictsLiveFeed: effectiveIdentity.conflictsLiveFeed,
      live: summarizeLocationIdentity(location),
      existingTrip: summarizeTripIdentity(existingTrip),
      scheduledResolution: scheduledResolution
        ? {
            source: scheduledResolution.source,
            segment: {
              key: scheduledResolution.segment.Key,
              scheduledDeparture: scheduledResolution.segment.DepartingTime,
              arrivingTerminalAbbrev:
                scheduledResolution.segment.ArrivingTerminalAbbrev,
              nextKey: scheduledResolution.segment.NextKey,
              nextScheduledDeparture:
                scheduledResolution.segment.NextDepartingTime,
            },
          }
        : null,
      effectiveLocation: summarizeLocationIdentity(effectiveLocation),
    })}`
  );
};

const summarizeLocationIdentity = (
  location: Pick<
    ConvexVesselLocation,
    | "AtDock"
    | "LeftDock"
    | "DepartingTerminalAbbrev"
    | "ArrivingTerminalAbbrev"
    | "ScheduledDeparture"
    | "ScheduleKey"
    | "Speed"
    | "DepartingDistance"
    | "ArrivingDistance"
  >
) => ({
  atDock: location.AtDock,
  leftDock: location.LeftDock,
  departingTerminalAbbrev: location.DepartingTerminalAbbrev,
  arrivingTerminalAbbrev: location.ArrivingTerminalAbbrev,
  scheduledDeparture: location.ScheduledDeparture,
  scheduleKey: location.ScheduleKey,
  speed: location.Speed,
  departingDistance: location.DepartingDistance,
  arrivingDistance: location.ArrivingDistance,
});

const summarizeTripIdentity = (trip: ConvexVesselTrip | undefined) =>
  trip
    ? {
        atDock: trip.AtDock,
        leftDock: trip.LeftDock,
        departingTerminalAbbrev: trip.DepartingTerminalAbbrev,
        arrivingTerminalAbbrev: trip.ArrivingTerminalAbbrev,
        scheduledDeparture: trip.ScheduledDeparture,
        scheduleKey: trip.ScheduleKey,
        nextScheduleKey: trip.NextScheduleKey,
        nextScheduledDeparture: trip.NextScheduledDeparture,
      }
    : null;
