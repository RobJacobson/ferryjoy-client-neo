/**
 * Builds schedule-derived dock-boundary records for event-table reloads.
 *
 * The module converts raw WSF schedule segments into neutral boundary records
 * before scheduled and actual event rows are derived.
 */

import {
  resolveScheduleSegment,
  type TerminalIdentity,
  type VesselIdentity,
} from "adapters";
import type { RawWsfScheduleSegment } from "adapters/fetch/fetchWsfScheduledTripsTypes";
import { buildBoundaryKey, buildSegmentKey } from "../../../shared/keys";
import {
  classifyDirectSegments,
  getOfficialCrossingTimeMinutes,
} from "../../scheduledTrips";
import type { DockBoundaryEventRecord } from "../types";
import {
  normalizeScheduledDockSeams,
  sortDockBoundaryEventRecords,
} from "./normalizeScheduledDockEventRecords";

const IDENTICAL_SCHEDULED_DOCK_TIME_OFFSET_MS = 5 * 60 * 1000;

/**
 * Produces normalized boundary records for every direct physical sailing segment.
 *
 * Pulls direct segments from raw route data, expands each into dep-dock and
 * arv-dock seeds, applies seam normalization for identical dock times, and sorts
 * so downstream hydration and reload see a deterministic vessel-day timeline.
 *
 * @param segments - Raw schedule segments from the fetch pipeline
 * @param vessels - Known vessel identities for abbreviation resolution
 * @param terminals - Terminal identities for segment resolution
 * @returns Ordered DockBoundaryEventRecord list ready for hydration and reload
 */
export const buildScheduledDockEventRecords = (
  segments: RawWsfScheduleSegment[],
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): DockBoundaryEventRecord[] =>
  normalizeScheduledDockSeams(
    getDirectRawSeedSegments(segments, vessels, terminals)
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
      .sort(sortDockBoundaryEventRecords)
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
 * Expands one resolved physical segment into paired departure and arrival seeds.
 *
 * SegmentKey ties both rows; boundary Keys follow the shared keys helper.
 * EventScheduledTime carries scheduled departure for dep-dock and inferred or
 * raw arrival time for arv-dock so normalizeScheduledDockSeams can detect seams.
 *
 * @param segment - Direct sail leg with terminals and scheduled instants
 * @returns Two records when SegmentKey resolves; otherwise an empty list
 */
const buildSeedEventsForSegment = (
  segment: SeedSegment
): DockBoundaryEventRecord[] => {
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
      EventOccurred: undefined,
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
      EventOccurred: undefined,
      EventActualTime: undefined,
    },
  ];
};

/**
 * Restricts raw route segments to direct trips in the classified seed shape.
 *
 * Non-direct patterns (multi-leg or shuttle) are excluded so reload seeds only
 * physical legs that match vessel-track identity rules used elsewhere.
 *
 * @param segments - Raw WSF schedule segments for one or more routes
 * @param vessels - Known vessel identities
 * @param terminals - Terminal identities
 * @returns Direct segments only, each with Key and crossing metadata
 */
export const getDirectRawSeedSegments = (
  segments: RawWsfScheduleSegment[],
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
) =>
  classifyDirectSegments(
    segments
      .map((segment) => toRawSeedSegment(segment, vessels, terminals))
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
 * Normalizes one adapter segment into the RawSeedSegment shape for classification.
 *
 * Resolves vessel and terminal abbreviations, derives the canonical segment Key,
 * and copies sailing-day and route metadata. Returns null when identities cannot
 * be resolved or Key construction fails.
 *
 * @param segment - Raw schedule segment from the fetch pipeline
 * @param vessels - Known vessel identities
 * @param terminals - Terminal identities
 * @returns Normalized seed or null when required identity fields are missing
 */
const toRawSeedSegment = (
  segment: RawWsfScheduleSegment,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): RawSeedSegment | null => {
  const resolvedSegment = resolveScheduleSegment(segment, vessels, terminals);

  if (!resolvedSegment) {
    return null;
  }

  const vesselAbbrev = resolvedSegment.vessel.VesselAbbrev;
  const departingTerminalAbbrev =
    resolvedSegment.departingTerminal.TerminalAbbrev;
  const arrivingTerminalAbbrev =
    resolvedSegment.arrivingTerminal.TerminalAbbrev;

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
 * Adjusts arrival scheduled times that equal departure on the same clock minute.
 *
 * When arrival and departure share the exact scheduled timestamp, subtracts a
 * small offset so normalizeScheduledDockSeams can detect and normalize the seam.
 *
 * @param scheduledArrival - Candidate arrival instant in epoch ms
 * @param scheduledDeparture - Departure instant for the same physical segment
 * @returns Possibly shifted arrival ms, or undefined when arrival was undefined
 */
const normalizeScheduledArrivalTime = (
  scheduledArrival: number | undefined,
  scheduledDeparture: number
) =>
  scheduledArrival !== undefined && scheduledArrival === scheduledDeparture
    ? scheduledArrival - IDENTICAL_SCHEDULED_DOCK_TIME_OFFSET_MS
    : scheduledArrival;

/**
 * Infers missing arrival times from official crossing duration when possible.
 *
 * Route 9 retains adapter-provided arriving times when present; other routes use
 * official crossing minutes from scheduledTrips to derive arrival from departure.
 *
 * @param segment - Direct segment being seeded (must include DepartingTime)
 * @returns Inferred arrival epoch ms, or undefined when duration cannot be resolved
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
