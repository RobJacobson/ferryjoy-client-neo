/**
 * Shared effective trip-identity normalization for docked live locations.
 */

import type { DockedScheduledSegmentSource } from "../functions/eventsScheduled/dockedScheduleResolver";
import type { ConvexInferredScheduledSegment } from "../functions/eventsScheduled/schemas";
import type { ConvexVesselLocation } from "../functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "../functions/vesselTrips/schemas";

type LocationLike = Pick<
  ConvexVesselLocation,
  | "AtDock"
  | "LeftDock"
  | "DepartingTerminalAbbrev"
  | "ArrivingTerminalAbbrev"
  | "ScheduledDeparture"
  | "Key"
>;

type TripLike = Pick<
  ConvexVesselTrip,
  | "AtDock"
  | "LeftDock"
  | "DepartingTerminalAbbrev"
  | "ArrivingTerminalAbbrev"
  | "ScheduledDeparture"
  | "SailingDay"
  | "Key"
  | "NextKey"
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
  Key?: string;
  NextKey?: string;
  NextScheduledDeparture?: number;
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
      (activeTrip.Key ||
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
      Key: location.Key,
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
      Key: activeTrip?.Key ?? location.Key,
      NextKey: activeTrip?.NextKey,
      NextScheduledDeparture: activeTrip?.NextScheduledDeparture,
      source: "active_trip",
      conflictsLiveFeed: conflictsWithLiveIdentity(location, {
        ArrivingTerminalAbbrev: activeTrip?.ArrivingTerminalAbbrev,
        ScheduledDeparture: activeTrip?.ScheduledDeparture,
        Key: activeTrip?.Key,
      }),
    };
  }

  if (scheduledSegment) {
    return {
      ArrivingTerminalAbbrev: scheduledSegment.ArrivingTerminalAbbrev,
      ScheduledDeparture: scheduledSegment.DepartingTime,
      SailingDay: scheduledSegment.SailingDay,
      Key: scheduledSegment.Key,
      NextKey: scheduledSegment.NextKey,
      NextScheduledDeparture: scheduledSegment.NextDepartingTime,
      source: scheduledSegmentSource ?? "dock_interval",
      conflictsLiveFeed: conflictsWithLiveIdentity(location, {
        ArrivingTerminalAbbrev: scheduledSegment.ArrivingTerminalAbbrev,
        ScheduledDeparture: scheduledSegment.DepartingTime,
        Key: scheduledSegment.Key,
      }),
    };
  }

  return {
    ArrivingTerminalAbbrev: location.ArrivingTerminalAbbrev,
    ScheduledDeparture: location.ScheduledDeparture,
    Key: location.Key,
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
  Key: identity.Key ?? location.Key,
});

const conflictsWithLiveIdentity = (
  location: LocationLike,
  identity: Pick<
    EffectiveTripIdentity,
    "ArrivingTerminalAbbrev" | "ScheduledDeparture" | "Key"
  >
) =>
  Boolean(
    (location.Key && identity.Key && location.Key !== identity.Key) ||
      (location.ScheduledDeparture !== undefined &&
        identity.ScheduledDeparture !== undefined &&
        location.ScheduledDeparture !== identity.ScheduledDeparture) ||
      (location.ArrivingTerminalAbbrev &&
        identity.ArrivingTerminalAbbrev &&
        location.ArrivingTerminalAbbrev !== identity.ArrivingTerminalAbbrev)
  );
