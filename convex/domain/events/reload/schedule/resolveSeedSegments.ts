/**
 * Resolves WSF schedule reload segments into direct raw seed segments and
 * builds dep/arv seed boundary rows for one physical sailing leg.
 */

import {
  resolveScheduleSegment,
  type TerminalIdentity,
  type VesselIdentity,
} from "adapters";
import { buildBoundaryKey, buildSegmentKey } from "shared/keys";
import {
  classifyDirectSegments,
  getOfficialCrossingTimeMinutes,
} from "../../../scheduledTrips";
import { IDENTICAL_SCHEDULED_DOCK_TIME_OFFSET_MS } from "../shared";
import type {
  DockStatusEventRecord,
  RawSeedSegment,
  WsfScheduledSegment,
} from "../types";
import { toAdapterScheduleSegment } from "./convertAdapterRows";

const normalizeScheduledArrivalTime = (
  scheduledArrival: number | undefined,
  scheduledDeparture: number
) =>
  scheduledArrival !== undefined && scheduledArrival === scheduledDeparture
    ? scheduledArrival - IDENTICAL_SCHEDULED_DOCK_TIME_OFFSET_MS
    : scheduledArrival;

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

/**
 * Builds dep and arv boundary records for one resolved direct segment.
 *
 * @param segment - Sailing day, terminals, and scheduled times for one leg
 * @returns Zero or two boundary rows when segment key resolves
 */
const buildSeedEventsForSegment = (segment: {
  SailingDay: string;
  VesselAbbrev: string;
  ScheduledDeparture: number;
  DepartingTerminalAbbrev: string;
  ArrivingTerminalAbbrev: string;
  ScheduledArrival?: number;
}): DockStatusEventRecord[] => {
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
    },
  ];
};

const toRawSeedSegment = (
  segment: WsfScheduledSegment,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): RawSeedSegment | null => {
  const resolvedSegment = resolveScheduleSegment(
    toAdapterScheduleSegment(segment),
    vessels,
    terminals
  );

  if (!resolvedSegment) {
    return null;
  }

  const key = buildSegmentKey(
    resolvedSegment.vessel.VesselAbbrev,
    resolvedSegment.departingTerminal.TerminalAbbrev,
    resolvedSegment.arrivingTerminal.TerminalAbbrev,
    new Date(segment.DepartingTime)
  );

  if (!key) {
    return null;
  }

  return {
    Key: key,
    VesselAbbrev: resolvedSegment.vessel.VesselAbbrev,
    DepartingTerminalAbbrev: resolvedSegment.departingTerminal.TerminalAbbrev,
    ArrivingTerminalAbbrev: resolvedSegment.arrivingTerminal.TerminalAbbrev,
    DepartingTime: segment.DepartingTime,
    ArrivingTime: segment.ArrivingTime,
    SailingDay: segment.SailingDay,
    RouteID: segment.RouteID,
    RouteAbbrev: segment.RouteAbbrev,
  };
};

/**
 * Filters schedule segments to direct sailing rows with resolved identities.
 *
 * @param segments - Numeric reload schedule segments
 * @param vessels - Vessel identities for adapter resolution
 * @param terminals - Terminal identities for adapter resolution
 * @returns Direct physical segments only
 */
const resolveSeedSegments = (
  segments: WsfScheduledSegment[],
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
) =>
  classifyDirectSegments(
    segments
      .map((segment) => toRawSeedSegment(segment, vessels, terminals))
      .filter((segment): segment is RawSeedSegment => segment !== null)
  ).filter((segment) => segment.TripType === "direct");

export {
  buildSeedEventsForSegment,
  getOfficialScheduledArrivalTime,
  normalizeScheduledArrivalTime,
  resolveSeedSegments,
};
