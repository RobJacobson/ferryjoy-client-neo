/**
 * Resolves WSF schedule segments into direct physical seed segments.
 *
 * Filters the WSF schedule wire shape down to the rows reload uses for boundary
 * projection, then attaches canonical vessel and terminal abbreviations plus a
 * stable segment key so later stages can join history, trips, and pings without
 * re-resolving identities.
 */

import {
  resolveScheduleSegment,
  type TerminalIdentity,
  type VesselIdentity,
} from "adapters";
import type { RawWsfScheduleSegment } from "adapters/fetch/fetchWsfScheduledTripsTypes";
import { buildSegmentKey } from "shared/keys";
import { classifyDirectSegments } from "../../../scheduledTrips";
import type { WsfScheduledSegment } from "../schemas";
import type { RawSeedSegment } from "../types";

/**
 * Filters WSF schedule segments to direct sailing rows with resolved identities.
 *
 * Combines adapter resolution with the schedule classifier so reload only emits
 * boundary records for legs that physically dock somewhere on the sailing day.
 * Rows that fail vessel or terminal resolution are dropped silently so a single
 * misnamed identity does not block the rest of the reload payload.
 *
 * @param segments - Numeric WSF schedule segments for one sailing day
 * @param vessels - Vessel identities for adapter resolution
 * @param terminals - Terminal identities for adapter resolution
 * @returns Direct physical seed segments ready for boundary projection
 */
const resolveDirectSeedSegments = (
  segments: WsfScheduledSegment[],
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): RawSeedSegment[] => {
  const rawSeedSegmentCandidates = segments
    .map((segment) => toRawSeedSegment(segment, vessels, terminals))
    .filter((segment): segment is RawSeedSegment => segment !== null);
  const classifiedDirectSegments = classifyDirectSegments(
    rawSeedSegmentCandidates
  );
  const directPhysicalSeedSegments = classifiedDirectSegments.filter(
    (segment) => segment.TripType === "direct"
  );

  return directPhysicalSeedSegments;
};

/**
 * Resolves one WSF schedule segment to the raw seed shape reload uses.
 *
 * @param segment - WSF schedule segment for one sailing leg
 * @param vessels - Vessel identities for adapter resolution
 * @param terminals - Terminal identities for adapter resolution
 * @returns Seed segment or null when identity or key resolution fails
 */
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

  if (resolvedSegment === null) {
    return null;
  }

  const key = buildSegmentKey(
    resolvedSegment.vessel.VesselAbbrev,
    resolvedSegment.departingTerminal.TerminalAbbrev,
    resolvedSegment.arrivingTerminal.TerminalAbbrev,
    new Date(segment.DepartingTime)
  );

  return key === undefined
    ? null
    : {
        Key: key,
        VesselAbbrev: resolvedSegment.vessel.VesselAbbrev,
        DepartingTerminalAbbrev:
          resolvedSegment.departingTerminal.TerminalAbbrev,
        ArrivingTerminalAbbrev: resolvedSegment.arrivingTerminal.TerminalAbbrev,
        DepartingTime: segment.DepartingTime,
        ArrivingTime: segment.ArrivingTime,
        SailingDay: segment.SailingDay,
        RouteID: segment.RouteID,
        RouteAbbrev: segment.RouteAbbrev,
      };
};

/**
 * Maps one epoch-ms scheduled segment to the adapter Date shape.
 *
 * @param segment - WSF scheduled segment using epoch-ms for trip times
 * @returns Adapter-shaped segment for resolveScheduleSegment
 */
const toAdapterScheduleSegment = (
  segment: WsfScheduledSegment
): RawWsfScheduleSegment =>
  ({
    ...segment,
    DepartingTime: new Date(segment.DepartingTime),
    ArrivingTime:
      segment.ArrivingTime === undefined
        ? undefined
        : new Date(segment.ArrivingTime),
  }) as RawWsfScheduleSegment;

export { resolveDirectSeedSegments };
