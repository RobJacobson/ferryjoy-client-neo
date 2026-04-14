/**
 * Normalize docked live locations into an effective trip identity for writes.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { resolveDockedScheduledSegment } from "functions/eventsScheduled/dockedScheduleResolver";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import {
  applyEffectiveTripIdentityToLocation,
  hasStableDockedTripIdentity,
  resolveEffectiveDockedTripIdentity,
} from "shared/effectiveTripIdentity";

/**
 * Resolve the effective location that downstream trip building should use.
 *
 * Raw `vesselLocations` stay feed-shaped, but the write pipeline can complete
 * transiently missing docked identity from the scheduled backbone.
 */
export const resolveEffectiveLocation = async (
  ctx: ActionCtx,
  location: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip | undefined
): Promise<ConvexVesselLocation> => {
  if (!location.AtDock || location.LeftDock !== undefined) {
    return location;
  }

  const stableDockedIdentity = hasStableDockedTripIdentity(
    location,
    existingTrip
  );
  const scheduledResolution = stableDockedIdentity
    ? null
    : await resolveDockedScheduledSegment(
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
        {
          vesselAbbrev: location.VesselAbbrev,
          departingTerminalAbbrev: location.DepartingTerminalAbbrev,
          existingTrip,
        }
      );

  const effectiveIdentity = resolveEffectiveDockedTripIdentity({
    location,
    activeTrip: existingTrip,
    scheduledSegment: scheduledResolution?.segment,
    scheduledSegmentSource: scheduledResolution?.source,
  });
  const effectiveLocation = applyEffectiveTripIdentityToLocation(
    location,
    effectiveIdentity
  );

  logDockedIdentityResolution({
    location,
    existingTrip,
    stableDockedIdentity,
    scheduledResolution,
    effectiveIdentity,
    effectiveLocation,
  });

  return effectiveLocation;
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
  effectiveIdentity: ReturnType<typeof resolveEffectiveDockedTripIdentity>;
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
