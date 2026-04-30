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
  if (!isNewTrip && previousTrip !== undefined) {
    return buildContinuingActiveTrip(previousTrip, location);
  }

  const activeTrip = buildNewActiveTrip(location);
  if (!isNewTrip) {
    return activeTrip;
  }

  const priorLeg = completedTrip ?? previousTrip;
  const priorLegDeparture =
    priorLeg?.LeftDockActual ?? priorLeg?.LeftDock ?? undefined;

  return {
    ...activeTrip,
    PrevTerminalAbbrev: priorLeg?.DepartingTerminalAbbrev,
    TripStart: location.TimeStamp,
    LeftDock: undefined,
    LeftDockActual: undefined,
    TripDelay: undefined,
    NextScheduleKey: previousTrip?.NextScheduleKey,
    NextScheduledDeparture: previousTrip?.NextScheduledDeparture,
    PrevScheduledDeparture: priorLeg?.ScheduledDeparture,
    PrevLeftDock: priorLegDeparture,
  };
};

/**
 * Builds a fresh active trip from the current ping.
 *
 * @param location - Incoming vessel location ping
 * @returns Active trip row with no prior-leg continuity
 */
const buildNewActiveTrip = (
  location: ConvexVesselLocation
): ConvexVesselTrip => {
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
    TripKey: generateTripKey(location.VesselAbbrev, location.TimeStamp),
    ScheduleKey: location.ScheduleKey ?? identity.ScheduleKey,
    SailingDay: identity.SailingDay,
    PrevTerminalAbbrev: undefined,
    TripStart: location.TimeStamp,
    TripEnd: undefined,
    AtDock: location.AtDockObserved,
    AtDockDuration: undefined,
    ScheduledDeparture: location.ScheduledDeparture,
    LeftDock: location.LeftDock,
    LeftDockActual: location.LeftDock,
    TripDelay: calculateTimeDelta(
      location.ScheduledDeparture,
      location.LeftDock
    ),
    Eta: location.Eta,
    NextScheduleKey: undefined,
    NextScheduledDeparture: undefined,
    AtSeaDuration: undefined,
    TotalDuration: undefined,
    InService: location.InService,
    TimeStamp: location.TimeStamp,
    PrevScheduledDeparture: undefined,
    PrevLeftDock: undefined,
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
    ...previousTrip,
    VesselAbbrev: location.VesselAbbrev,
    DepartingTerminalAbbrev: location.DepartingTerminalAbbrev,
    ArrivingTerminalAbbrev: resolvedArrivingTerminal,
    RouteAbbrev: location.RouteAbbrev,
    ScheduleKey:
      location.ScheduleKey ?? previousTrip.ScheduleKey ?? identity.ScheduleKey,
    SailingDay: identity.SailingDay ?? previousTrip.SailingDay,
    AtDock: location.AtDockObserved,
    AtDockDuration: calculateTimeDelta(
      previousTrip.TripEnd ?? previousTrip.TripStart,
      resolvedLeftDock
    ),
    ScheduledDeparture: resolvedScheduledDeparture,
    LeftDock: resolvedLeftDock,
    LeftDockActual:
      previousTrip.LeftDockActual ??
      (justLeftDock ? (location.LeftDock ?? location.TimeStamp) : undefined),
    TripDelay: calculateTimeDelta(resolvedScheduledDeparture, resolvedLeftDock),
    Eta: location.Eta ?? previousTrip.Eta,
    InService: location.InService,
    TimeStamp: location.TimeStamp,
  };
};
