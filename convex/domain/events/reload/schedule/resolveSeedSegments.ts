/**
 * Resolves WSF schedule reload segments into direct raw seed segments and
 * builds dep/arv seed boundary rows for one physical sailing leg.
 */

import {
  resolveScheduleSegment,
  type TerminalIdentity,
  type VesselIdentity,
} from "adapters";
import { buildSegmentKey } from "shared/keys";
import {
  classifyDirectSegments,
  getOfficialCrossingTimeMinutes,
} from "../../../scheduledTrips";
import type { WsfScheduledSegment } from "../schemas/validateReloadInput";
import { IDENTICAL_SCHEDULED_DOCK_TIME_OFFSET_MS } from "../shared";
import type { RawSeedSegment } from "../types";
import { toAdapterScheduleSegment } from "./convertAdapterRows";

/**
 * Nudges scheduled arrival time backward when it equals the dep instant.
 *
 * WSF data occasionally records arrivals at the same instant as their paired
 * departure for short crossings. Reload needs strictly ordered scheduled
 * boundaries within a segment, so this helper subtracts the seam offset to
 * restore dep-before-arv ordering without changing the published schedule.
 *
 * @param scheduledArrival - Scheduled arrival time in epoch milliseconds
 * @param scheduledDeparture - Scheduled departure time in epoch milliseconds
 * @returns Adjusted arrival time or the original value when distinct
 */
const normalizeScheduledArrivalTime = (
  scheduledArrival: number | undefined,
  scheduledDeparture: number
) =>
  scheduledArrival !== undefined && scheduledArrival === scheduledDeparture
    ? scheduledArrival - IDENTICAL_SCHEDULED_DOCK_TIME_OFFSET_MS
    : scheduledArrival;

/**
 * Resolves the schedule-implied arrival time when the segment lacks one.
 *
 * Most schedule segments expose ArrivingTime directly, but some legs only
 * carry a departure stamp plus a route-known crossing duration. Route 9 is
 * an exception that always trusts the supplied arrival because its duration
 * varies with tidal currents. Other routes fall back to the official crossing
 * minutes lookup so boundary records still have a usable scheduled arrival.
 *
 * @param segment - Direct seed segment for one physical leg
 * @returns Scheduled arrival in epoch ms, or undefined when unresolvable
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

/**
 * Resolves a raw WSF schedule segment into a normalized reload seed segment.
 *
 * @param segment - WSF schedule segment for one sailing leg
 * @param vessels - Vessel identities for adapter resolution
 * @param terminals - Terminal identities for adapter resolution
 * @returns Reload seed segment with stable keys, or null when resolution fails
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
 * WSF schedule data mixes direct legs with transfer or wait-around segments
 * that the dock-event timeline ignores. This entry resolves vessel and
 * terminal identities, applies the direct-leg classifier, and discards
 * segments that fail either check so downstream seeders see only the
 * physical boundaries they can persist as dock rows.
 *
 * @param segments - Numeric reload schedule segments for one sailing day
 * @param vessels - Vessel identities for adapter resolution
 * @param terminals - Terminal identities for adapter resolution
 * @returns Direct physical seed segments ready for boundary projection
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
  getOfficialScheduledArrivalTime,
  normalizeScheduledArrivalTime,
  resolveSeedSegments,
};
