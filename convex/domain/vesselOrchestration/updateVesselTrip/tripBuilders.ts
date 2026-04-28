/**
 * Trip row construction for one vessel ping.
 *
 * This module owns base trip construction, completion shaping, and the
 * schedule-facing enrichment path after lifecycle detection.
 */

import type {
  ScheduleDbAccess,
  TripLifecycleEventFlags,
} from "domain/vesselOrchestration/shared";
import type { TripFieldInferenceInput } from "domain/vesselOrchestration/updateVesselTrip/tripFields";
import { resolveTripFieldsForTripRow } from "domain/vesselOrchestration/updateVesselTrip/tripFields";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { calculateTimeDelta } from "shared/durationUtils";
import { generateTripKey } from "shared/physicalTripIdentity";
import { deriveTripIdentity } from "shared/tripIdentity";
import { logTripPipelineFailure } from "./storage";

type TripBuildEvents = TripLifecycleEventFlags & {
  leftDockTime: number | undefined;
};

type TripBuildInput = {
  vesselLocation: ConvexVesselLocation;
  existingActiveTrip?: ConvexVesselTrip;
  events: TripBuildEvents;
};

type TripRowOutcome = {
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
 * Builds completed/active trip rows for one vessel ping.
 *
 * @param update - Trip build input for the vessel ping
 * @param scheduleAccess - Narrow schedule continuity access
 * @returns Completed and/or active trip rows derived from lifecycle state
 */
export const buildUpdatedVesselRows = async (
  update: TripBuildInput,
  scheduleAccess: ScheduleDbAccess,
  onTripFieldsResolved?: (args: TripFieldInferenceInput) => void
): Promise<TripRowOutcome> => {
  // Finalize and immediately seed the next active trip when arrival completes.
  if (
    update.events.isCompletedTrip &&
    update.existingActiveTrip !== undefined
  ) {
    return tripRowsWhenCompleting(
      update as CompletedTripUpdate,
      scheduleAccess,
      onTripFieldsResolved
    );
  }

  // Ignore impossible completion events when no prior active trip exists.
  if (update.events.isCompletedTrip) {
    return {};
  }

  return tripRowsWhenContinuing(update, scheduleAccess, onTripFieldsResolved);
};

/**
 * Checks whether a trip has meaningful lifecycle evidence.
 *
 * @param existingTrip - Current active trip row, if present
 * @returns True when departure/arrival evidence exists
 */
const hasTripEvidence = (
  existingTrip: ConvexVesselTrip | undefined
): existingTrip is ConvexVesselTrip =>
  Boolean(
    existingTrip &&
      (existingTrip.LeftDockActual !== undefined ||
        existingTrip.ArrivedNextActual !== undefined ||
        existingTrip.LeftDock !== undefined ||
        existingTrip.ArriveDest !== undefined)
  );

/**
 * Resolves trip identity fields from resolved fields, feed values, and fallbacks.
 *
 * @param existingTrip - Current active trip row, if present
 * @param currLocation - Incoming vessel location ping
 * @param resolvedCurrentTripFields - Resolved current-trip fields from trip-field pipeline
 * @returns Resolved identity parts used by base trip construction
 */
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

/**
 * Builds the base active trip row for start or continuation scenarios.
 *
 * @param context - Location, existing trip, lifecycle flags, and resolved fields
 * @returns Base active trip row before schedule-next attachment adjustments
 */
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

/**
 * Finalizes an active trip into a completed trip row.
 *
 * @param existingTrip - Active trip row to finalize
 * @param currLocation - Incoming vessel location ping
 * @param hasTrustedArrival - Whether current ping qualifies as trusted arrival evidence
 * @returns Completed trip row with finalized timestamps and durations
 */
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

/**
 * Builds an active trip row and resolves schedule-linked trip fields.
 *
 * @param vesselLocation - Incoming vessel location ping
 * @param existingTrip - Current active trip row, if present
 * @param tripStart - Whether this row represents a newly started trip
 * @param events - Lifecycle events for this ping
 * @param scheduleAccess - Narrow schedule continuity access
 * @returns Active trip row with resolved current/next schedule fields
 */
const buildActiveTripForUpdate = async (
  vesselLocation: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip | undefined,
  tripStart: boolean,
  events: TripBuildEvents,
  scheduleAccess: ScheduleDbAccess,
  onTripFieldsResolved?: (args: TripFieldInferenceInput) => void
): Promise<ConvexVesselTrip> =>
  resolveTripFieldsForTripRow({
    location: vesselLocation,
    existingTrip,
    scheduleAccess,
    onTripFieldsResolved,
    buildTrip: (resolvedCurrentTripFields) => {
      const baseTrip = buildBaseTrip({
        currLocation: vesselLocation,
        existingTrip,
        tripStart,
        resolvedCurrentTripFields,
        events,
      });
      const withArriveDest = {
        ...baseTrip,
        // Seal arrival timestamp on the transition ping when needed.
        ArriveDest:
          baseTrip.ArriveDest ??
          (!tripStart && events.didJustArriveAtDock
            ? vesselLocation.TimeStamp
            : undefined),
      };
      // Clear next-leg schedule hints when physical identity or schedule anchor flips.
      const physicalIdentityReplaced =
        existingTrip?.TripKey !== undefined &&
        withArriveDest.TripKey !== undefined &&
        existingTrip.TripKey !== withArriveDest.TripKey;
      const scheduleAttachmentLost =
        existingTrip?.ScheduleKey !== undefined &&
        withArriveDest.ScheduleKey === undefined;

      return events.scheduleKeyChanged &&
        (physicalIdentityReplaced || scheduleAttachmentLost)
        ? {
            ...withArriveDest,
            NextScheduleKey: undefined,
            NextScheduledDeparture: undefined,
          }
        : withArriveDest;
    },
  });

/**
 * Builds rows for the completion path and seeds a replacement active row.
 *
 * @param update - Trip build input narrowed to completion with existing active trip
 * @param scheduleAccess - Narrow schedule continuity access
 * @returns Completed row plus replacement active row when successful
 */
const tripRowsWhenCompleting = async (
  update: CompletedTripUpdate,
  scheduleAccess: ScheduleDbAccess,
  onTripFieldsResolved?: (args: TripFieldInferenceInput) => void
): Promise<TripRowOutcome> => {
  try {
    // Snapshot completed row before constructing the next active leg.
    const completedVesselTrip = buildCompletedTrip(
      update.existingActiveTrip,
      update.vesselLocation,
      update.events.didJustArriveAtDock
    );
    const activeVesselTrip = await buildActiveTripForUpdate(
      update.vesselLocation,
      completedVesselTrip,
      true,
      update.events,
      scheduleAccess,
      onTripFieldsResolved
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

/**
 * Builds rows for the continuation path without finalizing a trip.
 *
 * @param update - Trip build input for continuation
 * @param scheduleAccess - Narrow schedule continuity access
 * @returns Active row update or safe fallback on failure
 */
const tripRowsWhenContinuing = async (
  update: TripBuildInput,
  scheduleAccess: ScheduleDbAccess,
  onTripFieldsResolved?: (args: TripFieldInferenceInput) => void
): Promise<TripRowOutcome> => {
  try {
    return {
      activeVesselTrip: await buildActiveTripForUpdate(
        update.vesselLocation,
        update.existingActiveTrip,
        false,
        update.events,
        scheduleAccess,
        onTripFieldsResolved
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
