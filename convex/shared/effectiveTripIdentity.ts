/**
 * Shared effective trip-identity normalization for docked live locations.
 */

import type { ConvexInferredScheduledSegment } from "../domain/events/scheduled/schemas";
import type { DockedScheduledSegmentSource } from "../domain/vesselOrchestration/updateVesselTrips";
import type { ConvexVesselLocation } from "../functions/vesselLocation/schemas";
import type { ConvexVesselTripWithPredictions } from "../functions/vesselTrips/schemas";

type LocationLike = Pick<
  ConvexVesselLocation,
  | "AtDock"
  | "LeftDock"
  | "DepartingTerminalAbbrev"
  | "ArrivingTerminalAbbrev"
  | "ScheduledDeparture"
  | "ScheduleKey"
>;

type TripLike = Pick<
  ConvexVesselTripWithPredictions,
  | "AtDock"
  | "LeftDock"
  | "DepartingTerminalAbbrev"
  | "ArrivingTerminalAbbrev"
  | "ScheduledDeparture"
  | "SailingDay"
  | "ScheduleKey"
  | "NextScheduleKey"
  | "NextScheduledDeparture"
>;

export type EffectiveTripIdentitySource =
  | "live"
  | "active_trip"
  | DockedScheduledSegmentSource;

export type EffectiveTripIdentity = {
  ArrivingTerminalAbbrev?: string;
  ScheduledDeparture?: number;
  SailingDay?: string;
  ScheduleKey?: string;
  NextScheduleKey?: string;
  NextScheduledDeparture?: number;
  /** Schedule/live identity selection only; not a physical boundary signal. */
  source: EffectiveTripIdentitySource;
  conflictsLiveFeed: boolean;
};

type ResolveEffectiveDockedTripIdentityArgs = {
  location: LocationLike;
  activeTrip?: TripLike | null;
  scheduledSegment?: ConvexInferredScheduledSegment | null;
  scheduledSegmentSource?: DockedScheduledSegmentSource;
};

/**
 * Detect whether a vessel should keep the currently persisted docked trip identity.
 */
export const hasStableDockedTripIdentity = (
  location: LocationLike,
  activeTrip?: TripLike | null
) =>
  Boolean(
    activeTrip?.AtDock &&
      activeTrip.LeftDock === undefined &&
      location.AtDock &&
      location.LeftDock === undefined &&
      activeTrip.DepartingTerminalAbbrev === location.DepartingTerminalAbbrev &&
      (activeTrip.ScheduleKey ||
        activeTrip.ScheduledDeparture !== undefined ||
        activeTrip.ArrivingTerminalAbbrev !== undefined)
  );

/**
 * Choose the effective trip identity that downstream systems should consume.
 */
export const resolveEffectiveDockedTripIdentity = ({
  location,
  activeTrip,
  scheduledSegment,
  scheduledSegmentSource,
}: ResolveEffectiveDockedTripIdentityArgs): EffectiveTripIdentity => {
  if (!location.AtDock || location.LeftDock !== undefined) {
    return {
      ArrivingTerminalAbbrev: location.ArrivingTerminalAbbrev,
      ScheduledDeparture: location.ScheduledDeparture,
      ScheduleKey: location.ScheduleKey,
      source: "live",
      conflictsLiveFeed: false,
    };
  }

  if (hasStableDockedTripIdentity(location, activeTrip)) {
    return {
      ArrivingTerminalAbbrev:
        activeTrip?.ArrivingTerminalAbbrev ?? location.ArrivingTerminalAbbrev,
      ScheduledDeparture:
        activeTrip?.ScheduledDeparture ?? location.ScheduledDeparture,
      SailingDay: activeTrip?.SailingDay,
      ScheduleKey: activeTrip?.ScheduleKey ?? location.ScheduleKey,
      NextScheduleKey: activeTrip?.NextScheduleKey,
      NextScheduledDeparture: activeTrip?.NextScheduledDeparture,
      source: "active_trip",
      conflictsLiveFeed: conflictsWithLiveIdentity(location, {
        ArrivingTerminalAbbrev: activeTrip?.ArrivingTerminalAbbrev,
        ScheduledDeparture: activeTrip?.ScheduledDeparture,
        ScheduleKey: activeTrip?.ScheduleKey,
      }),
    };
  }

  if (scheduledSegment && scheduledSegmentSource) {
    return {
      ArrivingTerminalAbbrev: scheduledSegment.ArrivingTerminalAbbrev,
      ScheduledDeparture: scheduledSegment.DepartingTime,
      SailingDay: scheduledSegment.SailingDay,
      ScheduleKey: scheduledSegment.Key,
      NextScheduleKey: scheduledSegment.NextKey,
      NextScheduledDeparture: scheduledSegment.NextDepartingTime,
      source: scheduledSegmentSource,
      conflictsLiveFeed: conflictsWithLiveIdentity(location, {
        ArrivingTerminalAbbrev: scheduledSegment.ArrivingTerminalAbbrev,
        ScheduledDeparture: scheduledSegment.DepartingTime,
        ScheduleKey: scheduledSegment.Key,
      }),
    };
  }

  return {
    ArrivingTerminalAbbrev: location.ArrivingTerminalAbbrev,
    ScheduledDeparture: location.ScheduledDeparture,
    ScheduleKey: location.ScheduleKey,
    source: "live",
    conflictsLiveFeed: false,
  };
};

/**
 * Overlay an effective trip identity onto a raw location-like object.
 */
export const applyEffectiveTripIdentityToLocation = <
  TLocation extends LocationLike,
>(
  location: TLocation,
  identity: EffectiveTripIdentity
): TLocation => ({
  ...location,
  ArrivingTerminalAbbrev:
    identity.ArrivingTerminalAbbrev ?? location.ArrivingTerminalAbbrev,
  ScheduledDeparture:
    identity.ScheduledDeparture ?? location.ScheduledDeparture,
  ScheduleKey: identity.ScheduleKey ?? location.ScheduleKey,
});

const conflictsWithLiveIdentity = (
  location: LocationLike,
  identity: Pick<
    EffectiveTripIdentity,
    "ArrivingTerminalAbbrev" | "ScheduledDeparture" | "ScheduleKey"
  >
) =>
  Boolean(
    (location.ScheduleKey &&
      identity.ScheduleKey &&
      location.ScheduleKey !== identity.ScheduleKey) ||
      (location.ScheduledDeparture !== undefined &&
        identity.ScheduledDeparture !== undefined &&
        location.ScheduledDeparture !== identity.ScheduledDeparture) ||
      (location.ArrivingTerminalAbbrev &&
        identity.ArrivingTerminalAbbrev &&
        location.ArrivingTerminalAbbrev !== identity.ArrivingTerminalAbbrev)
  );
