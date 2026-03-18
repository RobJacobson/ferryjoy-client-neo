/**
 * Builds schedule-derived vessel trip event rows for the `vesselTripEvents`
 * read model.
 */
import { classifyDirectSegmentsGeneric } from "../../domain/scheduledTrips/directSegments";
import { getOfficialCrossingTimeMinutes } from "../../domain/scheduledTrips/transform/officialCrossingTimes";
import type { ConvexScheduledTrip } from "../../functions/scheduledTrips/schemas";
import {
  getTerminalAbbreviation,
  getVesselAbbreviation,
} from "../../functions/scheduledTrips/schemas";
import type { ConvexVesselTripEvent } from "../../functions/vesselTripEvents/schemas";
import type { RawWsfScheduleSegment } from "../../shared/fetchWsfScheduleData";
import { generateTripKey } from "../../shared/keys";
import { buildEventKey, sortVesselTripEvents } from "./liveUpdates";

const IDENTICAL_SCHEDULED_DOCK_TIME_OFFSET_MS = 5 * 60 * 1000;

/**
 * Builds the persistent dock-boundary event skeleton used by
 * `VesselTimeline`.
 *
 * @param trips - Scheduled trips for one sailing day before read-model merge
 * @returns Sorted departure and arrival boundary rows for direct trips only
 */
export const buildSeedVesselTripEvents = (
  trips: ConvexScheduledTrip[]
): ConvexVesselTripEvent[] =>
  trips
    .filter((trip) => trip.TripType === "direct")
    .flatMap((trip) => {
      const ScheduledDeparture = trip.DepartingTime;
      const ScheduledArrival = getScheduledArrivalTime(trip);

      return [
        {
          Key: buildEventKey(
            trip.SailingDay,
            trip.VesselAbbrev,
            ScheduledDeparture,
            trip.DepartingTerminalAbbrev,
            "dep-dock"
          ),
          VesselAbbrev: trip.VesselAbbrev,
          SailingDay: trip.SailingDay,
          ScheduledDeparture,
          TerminalAbbrev: trip.DepartingTerminalAbbrev,
          EventType: "dep-dock" as const,
          // Departure rows always use the scheduled departure timestamp.
          ScheduledTime: trip.DepartingTime,
          PredictedTime: undefined,
          ActualTime: undefined,
        },
        {
          Key: buildEventKey(
            trip.SailingDay,
            trip.VesselAbbrev,
            ScheduledDeparture,
            trip.DepartingTerminalAbbrev,
            "arv-dock"
          ),
          VesselAbbrev: trip.VesselAbbrev,
          SailingDay: trip.SailingDay,
          ScheduledDeparture,
          TerminalAbbrev: trip.ArrivingTerminalAbbrev,
          EventType: "arv-dock" as const,
          // Arrival rows fall back to the next-day schedule field when needed.
          ScheduledTime: ScheduledArrival,
          PredictedTime: undefined,
          ActualTime: undefined,
        },
      ];
    })
    .sort(sortVesselTripEvents);

/**
 * Builds vessel trip event rows directly from raw WSF schedule segments,
 * applying only the minimal direct-segment classification needed by the
 * timeline read model.
 */
export const buildSeedVesselTripEventsFromRawSegments = (
  segments: RawWsfScheduleSegment[]
): ConvexVesselTripEvent[] =>
  getDirectRawSeedSegments(segments)
    .flatMap((segment) => {
      const ScheduledDeparture = segment.DepartingTime;
      const ScheduledArrival = getRawSegmentScheduledArrivalTime(segment);

      return [
        {
          Key: buildEventKey(
            segment.SailingDay,
            segment.VesselAbbrev,
            ScheduledDeparture,
            segment.DepartingTerminalAbbrev,
            "dep-dock"
          ),
          VesselAbbrev: segment.VesselAbbrev,
          SailingDay: segment.SailingDay,
          ScheduledDeparture,
          TerminalAbbrev: segment.DepartingTerminalAbbrev,
          EventType: "dep-dock" as const,
          ScheduledTime: ScheduledDeparture,
          PredictedTime: undefined,
          ActualTime: undefined,
        },
        {
          Key: buildEventKey(
            segment.SailingDay,
            segment.VesselAbbrev,
            ScheduledDeparture,
            segment.DepartingTerminalAbbrev,
            "arv-dock"
          ),
          VesselAbbrev: segment.VesselAbbrev,
          SailingDay: segment.SailingDay,
          ScheduledDeparture,
          TerminalAbbrev: segment.ArrivingTerminalAbbrev,
          EventType: "arv-dock" as const,
          ScheduledTime: ScheduledArrival,
          PredictedTime: undefined,
          ActualTime: undefined,
        },
      ];
    })
    .sort(sortVesselTripEvents);

export const getDirectRawSeedSegments = (segments: RawWsfScheduleSegment[]) =>
  classifyDirectSegmentsGeneric(
    segments
      .map(toRawSeedSegment)
      .filter((segment): segment is RawSeedSegment => segment !== null)
  ).filter((segment) => segment.TripType === "direct");

const getScheduledArrivalTime = (trip: ConvexScheduledTrip) => {
  const scheduledArrival = trip.ArrivingTime ?? trip.SchedArriveNext;

  if (
    scheduledArrival !== undefined &&
    scheduledArrival === trip.DepartingTime
  ) {
    return scheduledArrival - IDENTICAL_SCHEDULED_DOCK_TIME_OFFSET_MS;
  }

  return scheduledArrival;
};

export type RawSeedSegment = {
  Key: string;
  VesselAbbrev: string;
  DepartingTerminalAbbrev: string;
  ArrivingTerminalAbbrev: string;
  DepartingTime: number;
  ArrivingTime?: number;
  SailingDay: string;
  RouteID: number;
  RouteAbbrev: string;
};

const toRawSeedSegment = (
  segment: RawWsfScheduleSegment
): RawSeedSegment | null => {
  const vesselAbbrev = getVesselAbbreviation(segment.VesselName);
  const departingTerminalAbbrev = getTerminalAbbreviation(
    segment.DepartingTerminalName
  );
  const arrivingTerminalAbbrev = getTerminalAbbreviation(
    segment.ArrivingTerminalName
  );

  if (!vesselAbbrev || !departingTerminalAbbrev || !arrivingTerminalAbbrev) {
    return null;
  }

  const key = generateTripKey(
    vesselAbbrev,
    departingTerminalAbbrev,
    arrivingTerminalAbbrev,
    segment.DepartingTime
  );

  if (!key) {
    return null;
  }

  return {
    Key: key,
    VesselAbbrev: vesselAbbrev,
    DepartingTerminalAbbrev: departingTerminalAbbrev,
    ArrivingTerminalAbbrev: arrivingTerminalAbbrev,
    DepartingTime: segment.DepartingTime.getTime(),
    ArrivingTime: segment.ArrivingTime?.getTime(),
    SailingDay: segment.SailingDay,
    RouteID: segment.RouteID,
    RouteAbbrev: segment.RouteAbbrev,
  };
};

const getRawSegmentScheduledArrivalTime = (segment: RawSeedSegment) => {
  const scheduledArrival =
    segment.ArrivingTime ??
    getOfficialScheduledArrivalTime(segment) ??
    undefined;

  if (
    scheduledArrival !== undefined &&
    scheduledArrival === segment.DepartingTime
  ) {
    return scheduledArrival - IDENTICAL_SCHEDULED_DOCK_TIME_OFFSET_MS;
  }

  return scheduledArrival;
};

const getOfficialScheduledArrivalTime = (segment: RawSeedSegment) => {
  if (segment.RouteID === 9 && segment.ArrivingTime) {
    return segment.ArrivingTime;
  }

  const duration = getOfficialCrossingTimeMinutes({
    routeAbbrev: segment.RouteAbbrev,
    departingTerminalAbbrev: segment.DepartingTerminalAbbrev,
    arrivingTerminalAbbrev: segment.ArrivingTerminalAbbrev,
  });

  return duration !== undefined
    ? segment.DepartingTime + duration * 60 * 1000
    : undefined;
};
