/**
 * Resolve WSF schedule rows into direct seed legs for dock-event reload.
 *
 * Identity resolution and direct-segment classification happen before any row
 * materialization so later steps can join history, trips, and tracking through
 * the same stable segment key.
 */

import {
  resolveScheduleSegment,
  type TerminalIdentity,
  type VesselIdentity,
} from "adapters";
import type { RawWsfScheduleSegment } from "adapters/fetch/fetchWsfScheduledTripsTypes";
import { buildSegmentKey } from "shared/keys";
import { classifyDirectSegments } from "../../scheduledTrips";
import type { WsfScheduledSegment } from "./schemas";
import type { SeedLeg } from "./types";

/**
 * Filters WSF schedule segments to direct physical seed legs.
 *
 * Rows that fail vessel or terminal resolution are omitted so a single bad
 * identity from the upstream feed does not block the rest of the sailing-day
 * reload.
 *
 * @param scheduleSegments - WSF schedule segments for one sailing-day payload
 * @param vessels - Vessel identities used by adapter resolution
 * @param terminals - Terminal identities used by adapter resolution
 * @returns Direct seed legs with stable segment keys
 */
const resolveSeedLegs = (
  scheduleSegments: WsfScheduledSegment[],
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): SeedLeg[] =>
  classifyDirectSegments(
    scheduleSegments
      .map((segment) => toSeedLeg(segment, vessels, terminals))
      .filter(isDefined)
  ).filter((segment) => segment.TripType === "direct");

/**
 * Resolves one WSF schedule segment into reload seed-leg identity.
 *
 * @param segment - WSF schedule segment with epoch-ms times
 * @param vessels - Vessel identities used by adapter resolution
 * @param terminals - Terminal identities used by adapter resolution
 * @returns Seed leg or undefined when identity or key resolution fails
 */
const toSeedLeg = (
  segment: WsfScheduledSegment,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): SeedLeg | undefined => {
  const resolvedSegment = resolveScheduleSegment(
    toAdapterScheduleSegment(segment),
    vessels,
    terminals
  );
  const key =
    resolvedSegment === null
      ? undefined
      : buildSegmentKey(
          resolvedSegment.vessel.VesselAbbrev,
          resolvedSegment.departingTerminal.TerminalAbbrev,
          resolvedSegment.arrivingTerminal.TerminalAbbrev,
          new Date(segment.DepartingTime)
        );
  const seedLeg =
    resolvedSegment === null || key === undefined
      ? undefined
      : {
          Key: key,
          VesselAbbrev: resolvedSegment.vessel.VesselAbbrev,
          DepartingTerminalAbbrev:
            resolvedSegment.departingTerminal.TerminalAbbrev,
          ArrivingTerminalAbbrev:
            resolvedSegment.arrivingTerminal.TerminalAbbrev,
          DepartingTime: segment.DepartingTime,
          ArrivingTime: segment.ArrivingTime,
          SailingDay: segment.SailingDay,
          RouteID: segment.RouteID,
          RouteAbbrev: segment.RouteAbbrev,
        };

  return seedLeg;
};

/**
 * Converts reload schedule input to the adapter schedule shape.
 *
 * @param segment - WSF schedule segment with epoch-ms times
 * @returns Adapter-compatible segment with Date fields
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

/**
 * Narrows optional projection results.
 *
 * @param value - Candidate value from a projection
 * @returns True when the candidate is present
 */
const isDefined = <TValue>(value: TValue | undefined): value is TValue =>
  value !== undefined;

export { resolveSeedLegs };
