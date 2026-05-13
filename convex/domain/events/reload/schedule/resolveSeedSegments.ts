/**
 * Resolves WSF schedule reload segments into direct raw seed segments.
 */

import {
  resolveScheduleSegment,
  type TerminalIdentity,
  type VesselIdentity,
} from "adapters";
import { buildSegmentKey } from "shared/keys";
import { classifyDirectSegments } from "../../../scheduledTrips";
import type { WsfScheduledSegment } from "../schemas";
import type { RawSeedSegment } from "../types";
import { toAdapterScheduleSegment } from "./convertAdapterRows";

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

export { resolveSeedSegments };
