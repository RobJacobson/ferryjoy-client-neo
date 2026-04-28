/**
 * Basic trip-row construction from lifecycle state only.
 */

import type { TripLifecycleEventFlags } from "domain/vesselOrchestration/shared";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { calculateTimeDelta } from "shared/durationUtils";
import { generateTripKey } from "shared/physicalTripIdentity";
import { deriveTripIdentity } from "shared/tripIdentity";
import { logTripPipelineFailure } from "./storage";
import { hasTripEvidence } from "./tripEvidence";

export type TripBuildEvents = TripLifecycleEventFlags & {
  leftDockTime: number | undefined;
};

export type TripBuildInput = {
  vesselLocation: ConvexVesselLocation;
  existingActiveTrip?: ConvexVesselTrip;
  events: TripBuildEvents;
};

export type TripRowOutcome = {
  completedVesselTrip?: ConvexVesselTrip;
  activeVesselTrip?: ConvexVesselTrip;
};

type CompletedTripUpdate = TripBuildInput & {
  existingActiveTrip: ConvexVesselTrip;
};

type TripBuildLifecycleEvidence = {
  didJustLeaveDock: boolean;
  leftDockTime: number | undefined;
};

type TripBuildContext = {
  currLocation: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip | undefined;
  tripStart: boolean;
  resolvedCurrentTripFields: {
    ArrivingTerminalAbbrev?: string;
    ScheduledDeparture?: number;
    ScheduleKey?: string;
    SailingDay?: string;
  };
  events: TripBuildLifecycleEvidence;
};

type ResolvedTripIdentity = {
  arrivingTerminalAbbrev: string | undefined;
  scheduledDeparture: number | undefined;
  scheduleKey: string | undefined;
  sailingDay: string | undefined;
  previousCompletedTrip: ConvexVesselTrip | undefined;
};

/**
 * Builds completed/active rows from physical lifecycle state only.
 *
 * @param update - Trip build input for the vessel ping
 * @returns Basic trip rows before schedule-backed enrichment
 */
export const buildBasicUpdatedVesselRows = (
  update: TripBuildInput
): TripRowOutcome => {
  // Finalize and immediately seed the next active trip when arrival completes.
  if (
    update.events.isCompletedTrip &&
    update.existingActiveTrip !== undefined
  ) {
    return basicRowsWhenCompleting(update as CompletedTripUpdate);
  }

  // Ignore impossible completion events when no prior active trip exists.
  if (update.events.isCompletedTrip) {
    return {};
  }

  return basicRowsWhenContinuing(update);
};

const resolveTripIdentity = (
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation,
  resolvedCurrentTripFields: TripBuildContext["resolvedCurrentTripFields"]
): ResolvedTripIdentity => {
  const arrivingTerminalAbbrev =
    resolvedCurrentTripFields.ArrivingTerminalAbbrev ??
    currLocation.ArrivingTerminalAbbrev;
  const scheduledDeparture =
    resolvedCurrentTripFields.ScheduledDeparture ??
    currLocation.ScheduledDeparture;
  const identity = deriveTripIdentity({
    vesselAbbrev: currLocation.VesselAbbrev,
    departingTerminalAbbrev: currLocation.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev,
    scheduledDepartureMs: scheduledDeparture,
  });

  return {
    arrivingTerminalAbbrev,
    scheduledDeparture,
    scheduleKey:
      resolvedCurrentTripFields.ScheduleKey ??
      currLocation.ScheduleKey ??
      identity.ScheduleKey,
    sailingDay: resolvedCurrentTripFields.SailingDay ?? identity.SailingDay,
    previousCompletedTrip: hasTripEvidence(existingTrip)
      ? existingTrip
      : undefined,
  };
};

const buildBaseTrip = ({
  currLocation,
  existingTrip,
  tripStart,
  resolvedCurrentTripFields,
  events,
}: TripBuildContext): ConvexVesselTrip => {
  const identity = resolveTripIdentity(
    existingTrip,
    currLocation,
    resolvedCurrentTripFields
  );

  if (tripStart) {
    const startTime = currLocation.TimeStamp;
    const tripKey = generateTripKey(
      currLocation.VesselAbbrev,
      currLocation.TimeStamp
    );
    const prevCompleted = identity.previousCompletedTrip;

    return {
      VesselAbbrev: currLocation.VesselAbbrev,
      DepartingTerminalAbbrev: currLocation.DepartingTerminalAbbrev,
      ArrivingTerminalAbbrev: identity.arrivingTerminalAbbrev,
      RouteAbbrev: currLocation.RouteAbbrev,
      TripKey: tripKey,
      ScheduleKey: identity.scheduleKey,
      SailingDay: identity.sailingDay,
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
      AtDock: currLocation.AtDockObserved,
      AtDockDuration: undefined,
      ScheduledDeparture: identity.scheduledDeparture,
      LeftDock: undefined,
      TripDelay: undefined,
      Eta: undefined,
      NextScheduleKey: undefined,
      NextScheduledDeparture: undefined,
      TripEnd: undefined,
      AtSeaDuration: undefined,
      TotalDuration: undefined,
      InService: currLocation.InService,
      TimeStamp: currLocation.TimeStamp,
    };
  }

  const startTime =
    existingTrip === undefined
      ? currLocation.TimeStamp
      : existingTrip.StartTime;
  const arriveOriginTime = existingTrip?.ArrivedCurrActual;
  const arriveDestTime = existingTrip?.ArrivedNextActual;
  const departOriginTime =
    existingTrip?.LeftDockActual ??
    (events.didJustLeaveDock ? currLocation.TimeStamp : undefined);
  const tripKey =
    existingTrip?.TripKey ??
    generateTripKey(currLocation.VesselAbbrev, currLocation.TimeStamp);

  if (existingTrip !== undefined && existingTrip.TripKey === undefined) {
    throw new Error(
      "Continuing vessel trip is missing TripKey. Post-cutover data must " +
        "include TripKey on every active trip row."
    );
  }

  return {
    VesselAbbrev: currLocation.VesselAbbrev,
    DepartingTerminalAbbrev: currLocation.DepartingTerminalAbbrev,
    ArrivingTerminalAbbrev: identity.arrivingTerminalAbbrev,
    RouteAbbrev: currLocation.RouteAbbrev,
    TripKey: tripKey,
    ScheduleKey: identity.scheduleKey,
    SailingDay: identity.sailingDay,
    PrevTerminalAbbrev: existingTrip?.PrevTerminalAbbrev,
    PrevScheduledDeparture: existingTrip?.PrevScheduledDeparture,
    PrevLeftDock: existingTrip?.PrevLeftDock,
    ArrivedCurrActual: arriveOriginTime,
    ArrivedNextActual: arriveDestTime,
    LeftDockActual: departOriginTime,
    StartTime: startTime,
    EndTime: existingTrip?.EndTime,
    ArriveDest: arriveDestTime,
    AtDockActual: arriveOriginTime,
    TripStart: startTime,
    AtDock: currLocation.AtDockObserved,
    AtDockDuration: calculateTimeDelta(
      arriveDestTime ?? existingTrip?.EndTime ?? startTime,
      events.leftDockTime
    ),
    ScheduledDeparture: identity.scheduledDeparture,
    LeftDock: events.leftDockTime,
    TripDelay: calculateTimeDelta(
      identity.scheduledDeparture,
      events.leftDockTime
    ),
    Eta: currLocation.Eta ?? existingTrip?.Eta,
    NextScheduleKey: existingTrip?.NextScheduleKey,
    NextScheduledDeparture: existingTrip?.NextScheduledDeparture,
    TripEnd: existingTrip?.EndTime,
    AtSeaDuration: existingTrip?.AtSeaDuration,
    TotalDuration: existingTrip?.TotalDuration,
    InService: currLocation.InService,
    TimeStamp: currLocation.TimeStamp,
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

const buildBasicActiveTripForUpdate = (
  vesselLocation: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip | undefined,
  tripStart: boolean,
  events: TripBuildEvents
): ConvexVesselTrip => {
  const baseTrip = buildBaseTrip({
    currLocation: vesselLocation,
    existingTrip,
    tripStart,
    resolvedCurrentTripFields: {},
    events,
  });
  return {
    ...baseTrip,
    // Seal arrival timestamp on the transition ping when needed.
    ArriveDest:
      baseTrip.ArriveDest ??
      (!tripStart && events.didJustArriveAtDock
        ? vesselLocation.TimeStamp
        : undefined),
  };
};

const basicRowsWhenCompleting = (
  update: CompletedTripUpdate
): TripRowOutcome => {
  try {
    // Snapshot completed row before constructing the next active leg.
    const completedVesselTrip = buildCompletedTrip(
      update.existingActiveTrip,
      update.vesselLocation,
      update.events.didJustArriveAtDock
    );
    const activeVesselTrip = buildBasicActiveTripForUpdate(
      update.vesselLocation,
      completedVesselTrip,
      true,
      update.events
    );

    return { completedVesselTrip, activeVesselTrip };
  } catch (error) {
    logTripPipelineFailure(
      update.vesselLocation.VesselAbbrev,
      "finalizing completed trip",
      error
    );

    return {};
  }
};

const basicRowsWhenContinuing = (update: TripBuildInput): TripRowOutcome => {
  try {
    return {
      activeVesselTrip: buildBasicActiveTripForUpdate(
        update.vesselLocation,
        update.existingActiveTrip,
        false,
        update.events
      ),
    };
  } catch (error) {
    logTripPipelineFailure(
      update.vesselLocation.VesselAbbrev,
      "updating active trip",
      error
    );

    return {};
  }
};
