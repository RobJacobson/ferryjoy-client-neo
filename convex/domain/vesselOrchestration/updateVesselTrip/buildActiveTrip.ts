/**
 * Active-trip row shaping for first-seen, replacement, and continuing updates.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { calculateTimeDelta } from "shared/durationUtils";
import { generateTripKey } from "shared/physicalTripIdentity";
import { deriveTripIdentity } from "shared/tripIdentity";
import { didLeaveDock, leftDockTimeForUpdate } from "./lifecycleSignals";

type BuildActiveTripInput = {
  previousTrip: ConvexVesselTrip | undefined;
  completedTrip: ConvexVesselTrip | undefined;
  location: ConvexVesselLocation;
  isNewTrip: boolean;
};

/**
 * Builds the next active trip row for one vessel ping.
 *
 * @param input - Prior trip context, current location, and lifecycle transition
 * @returns Active trip row to persist
 */
export const buildActiveTrip = ({
  previousTrip,
  completedTrip,
  location,
  isNewTrip,
}: BuildActiveTripInput): ConvexVesselTrip => {
  if (isNewTrip) {
    return buildReplacementActiveTrip({
      previousTrip,
      completedTrip,
      location,
    });
  }

  if (previousTrip === undefined) {
    return buildFirstSeenActiveTrip(location);
  }

  return buildContinuingActiveTrip(previousTrip, location);
};

/**
 * Builds a new active trip when no prior row exists.
 *
 * @param location - Incoming vessel location ping
 * @returns First-seen active trip row
 */
const buildFirstSeenActiveTrip = (
  location: ConvexVesselLocation
): ConvexVesselTrip => {
  const tripKey = generateTripKey(location.VesselAbbrev, location.TimeStamp);
  const identity = deriveTripIdentity({
    vesselAbbrev: location.VesselAbbrev,
    departingTerminalAbbrev: location.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev: location.ArrivingTerminalAbbrev,
    scheduledDepartureMs: location.ScheduledDeparture,
  });

  return {
    VesselAbbrev: location.VesselAbbrev,
    DepartingTerminalAbbrev: location.DepartingTerminalAbbrev,
    ArrivingTerminalAbbrev: location.ArrivingTerminalAbbrev,
    RouteAbbrev: location.RouteAbbrev,
    TripKey: tripKey,
    ScheduleKey: location.ScheduleKey ?? identity.ScheduleKey,
    SailingDay: identity.SailingDay,
    PrevTerminalAbbrev: undefined,
    ArriveDest: undefined,
    ArrivedCurrActual: undefined,
    ArrivedNextActual: undefined,
    StartTime: location.TimeStamp,
    EndTime: undefined,
    AtDockActual: undefined,
    TripStart: location.TimeStamp,
    AtDock: location.AtDockObserved,
    AtDockDuration: undefined,
    ScheduledDeparture: location.ScheduledDeparture,
    LeftDock: location.LeftDock,
    LeftDockActual: undefined,
    TripDelay: calculateTimeDelta(location.ScheduledDeparture, location.LeftDock),
    Eta: location.Eta,
    NextScheduleKey: undefined,
    NextScheduledDeparture: undefined,
    TripEnd: undefined,
    AtSeaDuration: undefined,
    TotalDuration: undefined,
    InService: location.InService,
    TimeStamp: location.TimeStamp,
    PrevScheduledDeparture: undefined,
    PrevLeftDock: undefined,
  };
};

/**
 * Builds a replacement active trip immediately after a completed leg.
 *
 * @param input - Previous/completed trip context and current location
 * @returns Replacement active trip row with fresh lifecycle fields
 */
const buildReplacementActiveTrip = ({
  previousTrip,
  completedTrip,
  location,
}: {
  previousTrip: ConvexVesselTrip | undefined;
  completedTrip: ConvexVesselTrip | undefined;
  location: ConvexVesselLocation;
}): ConvexVesselTrip => {
  const tripKey = generateTripKey(location.VesselAbbrev, location.TimeStamp);
  const identity = deriveTripIdentity({
    vesselAbbrev: location.VesselAbbrev,
    departingTerminalAbbrev: location.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev: location.ArrivingTerminalAbbrev,
    scheduledDepartureMs: location.ScheduledDeparture,
  });
  const priorLeg = completedTrip ?? previousTrip;
  const previousDeparture =
    priorLeg?.LeftDockActual ?? priorLeg?.LeftDock ?? undefined;

  return {
    VesselAbbrev: location.VesselAbbrev,
    DepartingTerminalAbbrev: location.DepartingTerminalAbbrev,
    ArrivingTerminalAbbrev: location.ArrivingTerminalAbbrev,
    RouteAbbrev: location.RouteAbbrev,
    TripKey: tripKey,
    ScheduleKey: location.ScheduleKey ?? identity.ScheduleKey,
    SailingDay: identity.SailingDay,
    PrevTerminalAbbrev: priorLeg?.DepartingTerminalAbbrev,
    ArriveDest: undefined,
    ArrivedCurrActual: location.TimeStamp,
    ArrivedNextActual: undefined,
    StartTime: location.TimeStamp,
    EndTime: undefined,
    AtDockActual: location.TimeStamp,
    TripStart: location.TimeStamp,
    AtDock: location.AtDockObserved,
    AtDockDuration: undefined,
    ScheduledDeparture: location.ScheduledDeparture,
    LeftDock: undefined,
    LeftDockActual: undefined,
    TripDelay: undefined,
    Eta: location.Eta,
    NextScheduleKey: previousTrip?.NextScheduleKey,
    NextScheduledDeparture: previousTrip?.NextScheduledDeparture,
    TripEnd: undefined,
    AtSeaDuration: undefined,
    TotalDuration: undefined,
    InService: location.InService,
    TimeStamp: location.TimeStamp,
    PrevScheduledDeparture: priorLeg?.ScheduledDeparture,
    PrevLeftDock: previousDeparture,
  };
};

/**
 * Builds an in-place active-trip update for an ongoing leg.
 *
 * @param previousTrip - Existing active trip row
 * @param location - Incoming vessel location ping
 * @returns Continuing active trip row with updated feed-derived fields
 */
const buildContinuingActiveTrip = (
  previousTrip: ConvexVesselTrip,
  location: ConvexVesselLocation
): ConvexVesselTrip => {
  const resolvedArrivingTerminal =
    location.ArrivingTerminalAbbrev ?? previousTrip.ArrivingTerminalAbbrev;
  const resolvedScheduledDeparture =
    location.ScheduledDeparture ?? previousTrip.ScheduledDeparture;
  const identity = deriveTripIdentity({
    vesselAbbrev: location.VesselAbbrev,
    departingTerminalAbbrev: location.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev: resolvedArrivingTerminal,
    scheduledDepartureMs: resolvedScheduledDeparture,
  });
  const resolvedLeftDock = leftDockTimeForUpdate(previousTrip, location);
  const justLeftDock = didLeaveDock(previousTrip, location);

  return {
    VesselAbbrev: location.VesselAbbrev,
    DepartingTerminalAbbrev: location.DepartingTerminalAbbrev,
    ArrivingTerminalAbbrev: resolvedArrivingTerminal,
    RouteAbbrev: location.RouteAbbrev,
    TripKey: previousTrip.TripKey,
    ScheduleKey:
      location.ScheduleKey ?? previousTrip.ScheduleKey ?? identity.ScheduleKey,
    SailingDay: identity.SailingDay ?? previousTrip.SailingDay,
    PrevTerminalAbbrev: previousTrip.PrevTerminalAbbrev,
    ArriveDest: previousTrip.ArriveDest,
    ArrivedCurrActual: previousTrip.ArrivedCurrActual,
    ArrivedNextActual: previousTrip.ArrivedNextActual,
    StartTime: previousTrip.StartTime,
    EndTime: previousTrip.EndTime,
    AtDockActual: previousTrip.AtDockActual,
    TripStart: previousTrip.TripStart,
    AtDock: location.AtDockObserved,
    AtDockDuration: calculateTimeDelta(
      previousTrip.ArrivedNextActual ??
        previousTrip.EndTime ??
        previousTrip.StartTime,
      resolvedLeftDock
    ),
    ScheduledDeparture: resolvedScheduledDeparture,
    LeftDock: resolvedLeftDock,
    LeftDockActual:
      previousTrip.LeftDockActual ??
      (justLeftDock ? (location.LeftDock ?? location.TimeStamp) : undefined),
    TripDelay: calculateTimeDelta(
      resolvedScheduledDeparture,
      resolvedLeftDock
    ),
    Eta: location.Eta ?? previousTrip.Eta,
    NextScheduleKey: previousTrip.NextScheduleKey,
    NextScheduledDeparture: previousTrip.NextScheduledDeparture,
    TripEnd: previousTrip.TripEnd,
    AtSeaDuration: previousTrip.AtSeaDuration,
    TotalDuration: previousTrip.TotalDuration,
    InService: location.InService,
    TimeStamp: location.TimeStamp,
    PrevScheduledDeparture: previousTrip.PrevScheduledDeparture,
    PrevLeftDock: previousTrip.PrevLeftDock,
  };
};
