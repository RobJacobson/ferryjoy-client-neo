/**
 * Builds schedule-derived boundary-event records for VesselTimeline.
 */

import type { ConvexScheduledTrip } from "../../../functions/scheduledTrips/schemas";
import {
  getTerminalAbbreviation,
  getVesselAbbreviation,
} from "../../../functions/scheduledTrips/schemas";
import { classifyDirectSegments } from "../../../functions/scheduledTrips/sync/transform/directSegments";
import { getOfficialCrossingTimeMinutes } from "../../../functions/scheduledTrips/sync/transform/officialCrossingTimes";
import type { ConvexVesselTimelineEventRecord } from "../../../functions/vesselTimeline/eventRecordSchemas";
import type { RawWsfScheduleSegment } from "../../../shared/fetchWsfScheduleData";
import { buildBoundaryKey, buildSegmentKey } from "../../../shared/keys";
import {
  normalizeScheduledDockSeams,
  sortVesselTripEvents,
} from "./liveUpdates";

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
): ConvexVesselTimelineEventRecord[] =>
  normalizeScheduledDockSeams(
    trips
      .filter((trip) => trip.TripType === "direct")
      .flatMap((trip) =>
        buildSeedEventsForSegment({
          SailingDay: trip.SailingDay,
          VesselAbbrev: trip.VesselAbbrev,
          ScheduledDeparture: trip.DepartingTime,
          DepartingTerminalAbbrev: trip.DepartingTerminalAbbrev,
          ArrivingTerminalAbbrev: trip.ArrivingTerminalAbbrev,
          ScheduledArrival: normalizeScheduledArrivalTime(
            trip.ArrivingTime ?? trip.SchedArriveNext,
            trip.DepartingTime
          ),
        })
      )
      .sort(sortVesselTripEvents)
  );

/**
 * Builds vessel trip event rows directly from raw WSF schedule segments,
 * applying only the minimal direct-segment classification needed by the
 * timeline read model.
 */
export const buildSeedVesselTripEventsFromRawSegments = (
  segments: RawWsfScheduleSegment[]
): ConvexVesselTimelineEventRecord[] =>
  normalizeScheduledDockSeams(
    getDirectRawSeedSegments(segments)
      .flatMap((segment) =>
        buildSeedEventsForSegment({
          SailingDay: segment.SailingDay,
          VesselAbbrev: segment.VesselAbbrev,
          ScheduledDeparture: segment.DepartingTime,
          DepartingTerminalAbbrev: segment.DepartingTerminalAbbrev,
          ArrivingTerminalAbbrev: segment.ArrivingTerminalAbbrev,
          ScheduledArrival: normalizeScheduledArrivalTime(
            segment.ArrivingTime ?? getOfficialScheduledArrivalTime(segment),
            segment.DepartingTime
          ),
        })
      )
      .sort(sortVesselTripEvents)
  );

type SeedSegment = {
  SailingDay: string;
  VesselAbbrev: string;
  ScheduledDeparture: number;
  DepartingTerminalAbbrev: string;
  ArrivingTerminalAbbrev: string;
  ScheduledArrival?: number;
};

/**
 * Expands one physical segment into departure and arrival boundary events.
 *
 * @param segment - Direct vessel segment to convert into timeline events
 * @returns Departure and arrival event rows for the read model
 */
const buildSeedEventsForSegment = (
  segment: SeedSegment
): ConvexVesselTimelineEventRecord[] => {
  const SegmentKey = buildSegmentKey(
    segment.VesselAbbrev,
    segment.DepartingTerminalAbbrev,
    segment.ArrivingTerminalAbbrev,
    new Date(segment.ScheduledDeparture)
  );

  if (!SegmentKey) {
    return [];
  }

  return [
    {
      SegmentKey,
      Key: buildBoundaryKey(SegmentKey, "dep-dock"),
      VesselAbbrev: segment.VesselAbbrev,
      SailingDay: segment.SailingDay,
      ScheduledDeparture: segment.ScheduledDeparture,
      TerminalAbbrev: segment.DepartingTerminalAbbrev,
      EventType: "dep-dock",
      EventScheduledTime: segment.ScheduledDeparture,
      EventPredictedTime: undefined,
      EventActualTime: undefined,
    },
    {
      SegmentKey,
      Key: buildBoundaryKey(SegmentKey, "arv-dock"),
      VesselAbbrev: segment.VesselAbbrev,
      SailingDay: segment.SailingDay,
      ScheduledDeparture: segment.ScheduledDeparture,
      TerminalAbbrev: segment.ArrivingTerminalAbbrev,
      EventType: "arv-dock",
      EventScheduledTime: segment.ScheduledArrival,
      EventPredictedTime: undefined,
      EventActualTime: undefined,
    },
  ];
};

/**
 * Filters raw WSF schedule segments down to direct physical sailings that can
 * seed the timeline read model.
 *
 * @param segments - Raw WSF schedule segments for one or more routes
 * @returns Direct segments normalized into the seed classification shape
 */
export const getDirectRawSeedSegments = (segments: RawWsfScheduleSegment[]) =>
  classifyDirectSegments(
    segments
      .map(toRawSeedSegment)
      .filter((segment): segment is RawSeedSegment => segment !== null)
  ).filter((segment) => segment.TripType === "direct");

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

/**
 * Converts a raw WSF schedule segment into the normalized seed shape.
 *
 * @param segment - Raw schedule segment from the fetch pipeline
 * @returns Normalized segment or `null` when required identity fields are
 * missing
 */
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

  const key = buildSegmentKey(
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

/**
 * Normalizes scheduled arrival times for timeline seeding.
 *
 * @param scheduledArrival - Raw scheduled arrival candidate
 * @param scheduledDeparture - Scheduled departure for the same segment
 * @returns Normalized arrival timestamp for the event row
 */
const normalizeScheduledArrivalTime = (
  scheduledArrival: number | undefined,
  scheduledDeparture: number
) =>
  scheduledArrival !== undefined && scheduledArrival === scheduledDeparture
    ? scheduledArrival - IDENTICAL_SCHEDULED_DOCK_TIME_OFFSET_MS
    : scheduledArrival;

/**
 * Computes an arrival timestamp from official crossing-time data when the raw
 * schedule omits one.
 *
 * @param segment - Direct raw segment being seeded
 * @returns Scheduled arrival timestamp when one can be inferred
 */
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
