/**
 * Basic trip-row construction from lifecycle state only.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { calculateTimeDelta } from "shared/durationUtils";
import { generateTripKey } from "shared/physicalTripIdentity";
import { deriveTripIdentity } from "shared/tripIdentity";
import { hasTripEvidence } from "./tripEvidence";
import type { TripLifecycleEventFlags } from "./tripLifecycle";

export type TripBuildEvents = TripLifecycleEventFlags & {
  leftDockTime: number | undefined;
};

export type TripRowBuildInput = {
  vesselLocation: ConvexVesselLocation;
  existingActiveTrip?: ConvexVesselTrip;
  events: TripBuildEvents;
};

export type BuiltTripRows = {
  completedVesselTrip?: ConvexVesselTrip;
  activeVesselTrip?: ConvexVesselTrip;
};

type BasicTripIdentity = {
  arrivingTerminalAbbrev: string | undefined;
  scheduledDeparture: number | undefined;
  scheduleKey: string | undefined;
  sailingDay: string | undefined;
};

/**
 * Builds completed/active rows from physical lifecycle state only.
 *
 * @param update - Trip build input for the vessel ping
 * @returns Basic trip rows before schedule-backed enrichment
 */
export const buildBasicUpdatedVesselRows = (
  update: TripRowBuildInput
): BuiltTripRows => {
  if (
    update.events.isCompletedTrip &&
    update.existingActiveTrip !== undefined
  ) {
    return buildBasicRowsWhenCompleting({
      vesselLocation: update.vesselLocation,
      existingActiveTrip: update.existingActiveTrip,
      events: update.events,
    });
  }

  if (update.events.isCompletedTrip) {
    return {};
  }

  return {
    activeVesselTrip: buildContinuingActiveTrip({
      vesselLocation: update.vesselLocation,
      existingTrip: update.existingActiveTrip,
      events: update.events,
    }),
  };
};

const buildBasicRowsWhenCompleting = (update: {
  vesselLocation: ConvexVesselLocation;
  existingActiveTrip: ConvexVesselTrip;
  events: TripBuildEvents;
}): BuiltTripRows => {
  const completedVesselTrip = buildCompletedTrip(
    update.existingActiveTrip,
    update.vesselLocation,
    update.events.didJustArriveAtDock
  );
  const activeVesselTrip = buildStartedActiveTrip({
    vesselLocation: update.vesselLocation,
    previousTrip: completedVesselTrip,
  });

  return { completedVesselTrip, activeVesselTrip };
};

const resolveBasicTripIdentity = (
  currLocation: ConvexVesselLocation
): BasicTripIdentity => {
  const identity = deriveTripIdentity({
    vesselAbbrev: currLocation.VesselAbbrev,
    departingTerminalAbbrev: currLocation.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev: currLocation.ArrivingTerminalAbbrev,
    scheduledDepartureMs: currLocation.ScheduledDeparture,
  });

  return {
    arrivingTerminalAbbrev: currLocation.ArrivingTerminalAbbrev,
    scheduledDeparture: currLocation.ScheduledDeparture,
    scheduleKey: currLocation.ScheduleKey ?? identity.ScheduleKey,
    sailingDay: identity.SailingDay,
  };
};

const buildSharedActiveTripFields = (
  vesselLocation: ConvexVesselLocation
): Pick<
  ConvexVesselTrip,
  | "VesselAbbrev"
  | "DepartingTerminalAbbrev"
  | "ArrivingTerminalAbbrev"
  | "RouteAbbrev"
  | "ScheduleKey"
  | "SailingDay"
  | "AtDock"
  | "ScheduledDeparture"
  | "InService"
  | "TimeStamp"
> => {
  const identity = resolveBasicTripIdentity(vesselLocation);

  return {
    VesselAbbrev: vesselLocation.VesselAbbrev,
    DepartingTerminalAbbrev: vesselLocation.DepartingTerminalAbbrev,
    ArrivingTerminalAbbrev: identity.arrivingTerminalAbbrev,
    RouteAbbrev: vesselLocation.RouteAbbrev,
    ScheduleKey: identity.scheduleKey,
    SailingDay: identity.sailingDay,
    AtDock: vesselLocation.AtDockObserved,
    ScheduledDeparture: identity.scheduledDeparture,
    InService: vesselLocation.InService,
    TimeStamp: vesselLocation.TimeStamp,
  };
};

const buildStartedActiveTrip = ({
  vesselLocation,
  previousTrip,
}: {
  vesselLocation: ConvexVesselLocation;
  previousTrip: ConvexVesselTrip | undefined;
}): ConvexVesselTrip => {
  const sharedFields = buildSharedActiveTripFields(vesselLocation);
  const startTime = vesselLocation.TimeStamp;
  const tripKey = generateTripKey(
    vesselLocation.VesselAbbrev,
    vesselLocation.TimeStamp
  );
  const prevCompleted = hasTripEvidence(previousTrip)
    ? previousTrip
    : undefined;

  return {
    ...sharedFields,
    TripKey: tripKey,
    PrevTerminalAbbrev: prevCompleted?.DepartingTerminalAbbrev,
    PrevScheduledDeparture: prevCompleted?.ScheduledDeparture,
    PrevLeftDock: prevCompleted?.LeftDockActual ?? prevCompleted?.LeftDock,
    ArrivedCurrActual: startTime,
    ArrivedNextActual: undefined,
    StartTime: startTime,
    EndTime: undefined,
    ArriveDest: undefined,
    AtDockActual: startTime,
    TripStart: startTime,
    AtDockDuration: undefined,
    LeftDock: undefined,
    TripDelay: undefined,
    Eta: undefined,
    NextScheduleKey: undefined,
    NextScheduledDeparture: undefined,
    TripEnd: undefined,
    AtSeaDuration: undefined,
    TotalDuration: undefined,
  };
};

const buildContinuingActiveTrip = ({
  vesselLocation,
  existingTrip,
  events,
}: {
  vesselLocation: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip | undefined;
  events: TripBuildEvents;
}): ConvexVesselTrip => {
  if (existingTrip !== undefined && existingTrip.TripKey === undefined) {
    throw new Error(
      "Continuing vessel trip is missing TripKey. Post-cutover data must " +
        "include TripKey on every active trip row."
    );
  }

  const sharedFields = buildSharedActiveTripFields(vesselLocation);
  const scheduleFields = resolveContinuingTripScheduleFields(
    sharedFields,
    existingTrip
  );
  const startTime =
    existingTrip === undefined
      ? vesselLocation.TimeStamp
      : existingTrip.StartTime;
  const arriveOriginTime = existingTrip?.ArrivedCurrActual;
  const arriveDestTime = existingTrip?.ArrivedNextActual;
  const departOriginTime =
    existingTrip?.LeftDockActual ??
    (events.didJustLeaveDock ? vesselLocation.TimeStamp : undefined);
  const tripKey =
    existingTrip?.TripKey ??
    generateTripKey(vesselLocation.VesselAbbrev, vesselLocation.TimeStamp);
  const arriveDest =
    arriveDestTime ??
    (events.didJustArriveAtDock ? vesselLocation.TimeStamp : undefined);

  return {
    ...sharedFields,
    ...scheduleFields,
    TripKey: tripKey,
    PrevTerminalAbbrev: existingTrip?.PrevTerminalAbbrev,
    PrevScheduledDeparture: existingTrip?.PrevScheduledDeparture,
    PrevLeftDock: existingTrip?.PrevLeftDock,
    ArrivedCurrActual: arriveOriginTime,
    ArrivedNextActual: arriveDestTime,
    LeftDockActual: departOriginTime,
    StartTime: startTime,
    EndTime: existingTrip?.EndTime,
    ArriveDest: arriveDest,
    AtDockActual: arriveOriginTime,
    TripStart: startTime,
    AtDockDuration: calculateTimeDelta(
      arriveDestTime ?? existingTrip?.EndTime ?? startTime,
      events.leftDockTime
    ),
    LeftDock: events.leftDockTime,
    TripDelay: calculateTimeDelta(
      scheduleFields.ScheduledDeparture,
      events.leftDockTime
    ),
    Eta: vesselLocation.Eta ?? existingTrip?.Eta,
    NextScheduleKey: existingTrip?.NextScheduleKey,
    NextScheduledDeparture: existingTrip?.NextScheduledDeparture,
    TripEnd: existingTrip?.EndTime,
    AtSeaDuration: existingTrip?.AtSeaDuration,
    TotalDuration: existingTrip?.TotalDuration,
  };
};

const resolveContinuingTripScheduleFields = (
  sharedFields: ReturnType<typeof buildSharedActiveTripFields>,
  existingTrip: ConvexVesselTrip | undefined
): Pick<
  ConvexVesselTrip,
  "ArrivingTerminalAbbrev" | "ScheduledDeparture" | "ScheduleKey" | "SailingDay"
> => {
  const arrivingTerminalAbbrev =
    sharedFields.ArrivingTerminalAbbrev ?? existingTrip?.ArrivingTerminalAbbrev;
  const scheduledDeparture =
    sharedFields.ScheduledDeparture ?? existingTrip?.ScheduledDeparture;
  const identity = deriveTripIdentity({
    vesselAbbrev: sharedFields.VesselAbbrev,
    departingTerminalAbbrev: sharedFields.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev,
    scheduledDepartureMs: scheduledDeparture,
  });

  return {
    ArrivingTerminalAbbrev: arrivingTerminalAbbrev,
    ScheduledDeparture: scheduledDeparture,
    ScheduleKey:
      sharedFields.ScheduleKey ??
      existingTrip?.ScheduleKey ??
      identity.ScheduleKey,
    SailingDay: identity.SailingDay ?? existingTrip?.SailingDay,
  };
};

const buildCompletedTrip = (
  existingTrip: ConvexVesselTrip,
  currLocation: ConvexVesselLocation,
  hasTrustedArrival: boolean
): ConvexVesselTrip => {
  const completionTime = currLocation.TimeStamp;
  const trustedArrivalTime = hasTrustedArrival ? completionTime : undefined;
  const withTripEnd = {
    ...existingTrip,
    ArrivingTerminalAbbrev:
      existingTrip.ArrivingTerminalAbbrev ??
      currLocation.DepartingTerminalAbbrev,
    ArrivedCurrActual: existingTrip.ArrivedCurrActual,
    ArrivedNextActual: trustedArrivalTime,
    LeftDockActual: existingTrip.LeftDockActual,
    StartTime: existingTrip.StartTime,
    EndTime: completionTime,
    ArriveDest: trustedArrivalTime,
    TripEnd: completionTime,
  };
  const departureForDurations =
    withTripEnd.LeftDockActual ?? withTripEnd.LeftDock;
  const tripStartForDurations = withTripEnd.StartTime ?? withTripEnd.TripStart;
  const arrivalForDurations = trustedArrivalTime ?? completionTime;

  return {
    ...withTripEnd,
    AtSeaDuration: calculateTimeDelta(
      departureForDurations,
      arrivalForDurations
    ),
    TotalDuration: calculateTimeDelta(tripStartForDurations, completionTime),
    AtDockActual: withTripEnd.ArrivedCurrActual ?? withTripEnd.AtDockActual,
    LeftDockActual: withTripEnd.LeftDockActual ?? withTripEnd.LeftDock,
  };
};
