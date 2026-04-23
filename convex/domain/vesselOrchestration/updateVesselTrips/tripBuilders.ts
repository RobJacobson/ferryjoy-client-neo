/**
 * Trip row builders for one vessel ping.
 *
 * This module owns base trip construction, completion shaping, and the
 * schedule-facing enrichment path that runs after trip fields are resolved.
 */

import type { ScheduledSegmentTables } from "domain/vesselOrchestration/shared/scheduleContinuity";
import type { TripFieldInferenceInput } from "domain/vesselOrchestration/updateVesselTrips/tripFields";
import {
  attachNextScheduledTripFields,
  logTripFieldInference,
  resolveCurrentTripFields,
} from "domain/vesselOrchestration/updateVesselTrips/tripFields";
import type { ResolvedCurrentTripFields } from "domain/vesselOrchestration/updateVesselTrips/tripFields/types";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { calculateTimeDelta } from "shared/durationUtils";
import { generateTripKey } from "shared/physicalTripIdentity";
import { deriveTripIdentity } from "shared/tripIdentity";
import {
  type TripEvents,
  hasTripEvidence,
} from "./lifecycle";
import { logTripPipelineFailure } from "./storage";
import type { VesselTripUpdates } from "./types";

type BuildTripCoreOptions = {
  onTripFieldsResolved?: (args: TripFieldInferenceInput) => void;
};

type TripRowOutcome = {
  completedVesselTrip?: ConvexVesselTrip;
  activeVesselTrip?: ConvexVesselTrip;
};

type CalculatedTripUpdate = {
  vesselLocation: VesselTripUpdates["vesselLocation"];
  existingActiveTrip?: VesselTripUpdates["existingActiveTrip"];
  events: TripEvents;
};

type CompletedTripUpdate = CalculatedTripUpdate & {
  existingActiveTrip: ConvexVesselTrip;
};

type TripBuildContext = {
  currLocation: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip | undefined;
  tripStart: boolean;
  resolvedCurrentTripFields: ResolvedCurrentTripFields;
  events: Pick<TripEvents, "didJustLeaveDock" | "leftDockTime">;
};

type ResolvedTripIdentity = {
  arrivingTerminalAbbrev: string | undefined;
  scheduledDeparture: number | undefined;
  scheduleKey: string | undefined;
  sailingDay: string | undefined;
  previousCompletedTrip: ConvexVesselTrip | undefined;
};

const resolveTripIdentity = (
  existingTrip: ConvexVesselTrip | undefined,
  currLocation: ConvexVesselLocation,
  resolvedCurrentTripFields: ResolvedCurrentTripFields
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

const baseTripFromContext = ({
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
      AtDock: currLocation.AtDock,
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

  const isBootstrapTrip = existingTrip === undefined;
  const startTime = isBootstrapTrip
    ? currLocation.TimeStamp
    : existingTrip?.StartTime;
  const arriveOriginTime = existingTrip?.ArrivedCurrActual;
  const arriveDestTime = existingTrip?.ArrivedNextActual;
  const departOriginTime =
    existingTrip?.LeftDockActual ??
    (events.didJustLeaveDock ? currLocation.TimeStamp : undefined);
  const endTime = existingTrip?.EndTime;
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
    EndTime: endTime,
    ArriveDest: arriveDestTime,
    AtDockActual: arriveOriginTime,
    TripStart: startTime,
    AtDock: currLocation.AtDock,
    AtDockDuration: calculateTimeDelta(
      arriveDestTime ?? endTime ?? startTime,
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
    TripEnd: endTime,
    AtSeaDuration: existingTrip?.AtSeaDuration,
    TotalDuration: existingTrip?.TotalDuration,
    InService: currLocation.InService,
    TimeStamp: currLocation.TimeStamp,
  };
};

export const baseTripFromLocation = (
  currLocation: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip | undefined,
  tripStart: boolean,
  resolvedCurrentTripFields: ResolvedCurrentTripFields,
  events: Pick<TripEvents, "didJustLeaveDock" | "leftDockTime">
): ConvexVesselTrip =>
  baseTripFromContext({
    currLocation,
    existingTrip,
    tripStart,
    resolvedCurrentTripFields,
    events,
  });

export const buildCompletedTrip = (
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

export const buildTripCore = (
  currLocation: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip | undefined,
  tripStart: boolean,
  events: TripEvents,
  scheduleTables: ScheduledSegmentTables,
  options?: BuildTripCoreOptions
): ConvexVesselTrip => {
  const resolvedCurrentTripFields = resolveCurrentTripFields({
    location: currLocation,
    existingTrip,
    scheduleTables,
  });
  options?.onTripFieldsResolved?.({
    location: currLocation,
    existingTrip,
    resolvedCurrentTripFields,
  });
  const baseTrip = baseTripFromContext({
    currLocation,
    existingTrip,
    tripStart,
    resolvedCurrentTripFields,
    events,
  });
  const withArriveDest = {
    ...baseTrip,
    ArriveDest:
      baseTrip.ArriveDest ??
      (!tripStart && events.didJustArriveAtDock
        ? currLocation.TimeStamp
        : undefined),
  };
  const physicalIdentityReplaced =
    existingTrip?.TripKey !== undefined &&
    withArriveDest.TripKey !== undefined &&
    existingTrip.TripKey !== withArriveDest.TripKey;
  const scheduleAttachmentLost =
    existingTrip?.ScheduleKey !== undefined &&
    withArriveDest.ScheduleKey === undefined;
  const candidateTrip =
    events.scheduleKeyChanged &&
    (physicalIdentityReplaced || scheduleAttachmentLost)
      ? {
          ...withArriveDest,
          NextScheduleKey: undefined,
          NextScheduledDeparture: undefined,
        }
      : withArriveDest;

  return attachNextScheduledTripFields({
    baseTrip: candidateTrip,
    existingTrip,
    scheduleTables,
  });
};

const buildActiveTripForUpdate = (
  vesselLocation: CalculatedTripUpdate["vesselLocation"],
  existingTrip: CalculatedTripUpdate["existingActiveTrip"],
  tripStart: boolean,
  events: CalculatedTripUpdate["events"],
  scheduleTables: ScheduledSegmentTables
): ReturnType<typeof buildTripCore> =>
  buildTripCore(vesselLocation, existingTrip, tripStart, events, scheduleTables, {
    onTripFieldsResolved: logTripFieldInference,
  });

const tripRowsWhenCompleting = (
  update: CompletedTripUpdate,
  scheduleTables: ScheduledSegmentTables
): TripRowOutcome => {
  try {
    const completedVesselTrip = buildCompletedTrip(
      update.existingActiveTrip,
      update.vesselLocation,
      update.events.didJustArriveAtDock
    );
    const activeVesselTrip = buildActiveTripForUpdate(
      update.vesselLocation,
      completedVesselTrip,
      true,
      update.events,
      scheduleTables
    );

    return { completedVesselTrip, activeVesselTrip };
  } catch (error) {
    logTripPipelineFailure(
      update.vesselLocation.VesselAbbrev,
      "finalizing completed trip",
      error
    );

    return { activeVesselTrip: update.existingActiveTrip };
  }
};

const tripRowsWhenContinuing = (
  update: CalculatedTripUpdate,
  scheduleTables: ScheduledSegmentTables
): TripRowOutcome => {
  try {
    const activeVesselTrip = buildActiveTripForUpdate(
      update.vesselLocation,
      update.existingActiveTrip,
      false,
      update.events,
      scheduleTables
    );

    return { activeVesselTrip };
  } catch (error) {
    logTripPipelineFailure(
      update.vesselLocation.VesselAbbrev,
      "updating active trip",
      error
    );

    return update.existingActiveTrip !== undefined
      ? { activeVesselTrip: update.existingActiveTrip }
      : {};
  }
};

export const buildTripRowsForPing = (
  update: CalculatedTripUpdate,
  scheduleTables: ScheduledSegmentTables
): TripRowOutcome => {
  const canCloseCompletion =
    update.events.isCompletedTrip && update.existingActiveTrip !== undefined;

  if (canCloseCompletion) {
    return tripRowsWhenCompleting(update as CompletedTripUpdate, scheduleTables);
  }

  if (update.events.isCompletedTrip) {
    return {};
  }

  return tripRowsWhenContinuing(update, scheduleTables);
};
