import type {
  ConvexInferredScheduledSegment,
  ConvexScheduledDockEvent,
} from "domain/events/scheduled/schemas";
import {
  findNextDepartureEvent,
  inferScheduledSegmentFromDepartureEvent,
} from "domain/timelineRows/scheduledSegmentResolvers";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { deriveTripIdentity } from "shared/tripIdentity";
import type { UpdateVesselTripDbAccess } from "../types";
import type { ResolvedCurrentTripFields } from "./types";

type ResolveScheduleFromTripArrivalInput = {
  location: ConvexVesselLocation;
  existingTrip: ConvexVesselTrip | undefined;
  scheduleAccess: UpdateVesselTripDbAccess;
};

export type ResolvedTripScheduleFields = {
  current: ResolvedCurrentTripFields;
  next?: {
    NextScheduleKey?: string;
    NextScheduledDeparture?: number;
  };
};

/** Path B schedule inference: uses `existingTrip` for `NextScheduleKey` only; does not merge prior row into current schedule before DB lookups. */
export const resolveScheduleFromTripArrival = async ({
  location,
  existingTrip,
  scheduleAccess,
}: ResolveScheduleFromTripArrivalInput): Promise<ResolvedTripScheduleFields> => {
  const { DepartingTerminalAbbrev } = location;

  const nextKey = existingTrip?.NextScheduleKey;
  const rawNextSegment =
    nextKey === undefined
      ? null
      : await scheduleAccess.getScheduledSegmentByScheduleKey(nextKey);
  const segmentFromNextKey =
    rawNextSegment?.DepartingTerminalAbbrev === DepartingTerminalAbbrev
      ? rawNextSegment
      : null;

  if (segmentFromNextKey) {
    return resolutionFromSegment(segmentFromNextKey, "next_scheduled_trip");
  }

  const rollover = await scheduleAccess.getScheduleRolloverDockEvents({
    vesselAbbrev: location.VesselAbbrev,
    timestamp: location.TimeStamp,
  });
  const segmentFromRollover =
    segmentAfterDepartureInPool(
      rollover.currentDayEvents,
      DepartingTerminalAbbrev,
      location.TimeStamp
    ) ??
    segmentAfterDepartureInPool(
      rollover.nextDayEvents,
      DepartingTerminalAbbrev,
      Number.NEGATIVE_INFINITY
    );

  if (segmentFromRollover) {
    return resolutionFromSegment(segmentFromRollover, "schedule_rollover");
  }

  console.warn("[TripFields] schedule inference unavailable", {
    vesselAbbrev: location.VesselAbbrev,
    departingTerminalAbbrev: DepartingTerminalAbbrev,
    timeStamp: location.TimeStamp,
    existingScheduleKey: existingTrip?.ScheduleKey,
    existingNextScheduleKey: existingTrip?.NextScheduleKey,
  });
  return {
    current: resolveCarriedCurrentTripFields(location, undefined),
  };
};

/** Next leg from scheduled dock rows after `afterTime` at `departingTerminalAbbrev`. */
const segmentAfterDepartureInPool = (
  events: ReadonlyArray<ConvexScheduledDockEvent>,
  departingTerminalAbbrev: string | undefined,
  afterTime: number
): ConvexInferredScheduledSegment | null => {
  const pool = [...events];
  const departure = findNextDepartureEvent(pool, {
    terminalAbbrev: departingTerminalAbbrev,
    afterTime,
  });
  return departure
    ? inferScheduledSegmentFromDepartureEvent(departure, pool)
    : null;
};

const resolveCarriedCurrentTripFields = (
  location: ConvexVesselLocation,
  existingTrip: ConvexVesselTrip | undefined
): ResolvedCurrentTripFields => {
  const arrivingTerminalAbbrev =
    existingTrip?.ArrivingTerminalAbbrev ?? location.ArrivingTerminalAbbrev;
  const scheduledDeparture =
    existingTrip?.ScheduledDeparture ?? location.ScheduledDeparture;
  const identity = deriveTripIdentity({
    vesselAbbrev: location.VesselAbbrev,
    departingTerminalAbbrev: location.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev,
    scheduledDepartureMs: scheduledDeparture,
  });

  return {
    ArrivingTerminalAbbrev: arrivingTerminalAbbrev,
    ScheduledDeparture: scheduledDeparture,
    ScheduleKey:
      location.ScheduleKey ?? existingTrip?.ScheduleKey ?? identity.ScheduleKey,
    SailingDay: identity.SailingDay ?? existingTrip?.SailingDay,
    tripFieldDataSource: "inferred",
  };
};

const resolutionFromSegment = (
  segment: ConvexInferredScheduledSegment,
  method: ResolvedCurrentTripFields["tripFieldInferenceMethod"]
): ResolvedTripScheduleFields => ({
  current: {
    ArrivingTerminalAbbrev: segment.ArrivingTerminalAbbrev,
    ScheduledDeparture: segment.DepartingTime,
    ScheduleKey: segment.Key,
    SailingDay: segment.SailingDay,
    tripFieldDataSource: "inferred",
    tripFieldInferenceMethod: method,
  },
  next: {
    NextScheduleKey: segment.NextKey,
    NextScheduledDeparture: segment.NextDepartingTime,
  },
});
