/**
 * Builds journey chains from flat scheduled segments by walking the NextKey linked list.
 *
 * Simple model: find segments starting at A, traverse until reaching B (or end of chain),
 * return chains chronologically. No grouping or target-selection logic.
 */

import type { ScheduledTrip } from "convex/functions/scheduledTrips/schemas";
import type { ScheduledTripJourney } from "../types";

/**
 * Walks the NextKey chain from start until reaching targetTerminal or end.
 *
 * @param start - First segment to include
 * @param targetTerminal - Optional destination; stop when a segment arrives here
 * @param byKey - Map of Key to ScheduledTrip for NextKey traversal
 * @returns Chain of segments, or null if target not reached when destination specified
 */
const walkUntil = (
  start: ScheduledTrip,
  targetTerminal: string | undefined,
  byKey: Map<string, ScheduledTrip>
): ScheduledTrip[] | null => {
  const segments: ScheduledTrip[] = [];
  let current: ScheduledTrip | undefined = start;

  while (current && !segments.some((s) => s.Key === current?.Key)) {
    segments.push(current);
    if (targetTerminal && current.ArrivingTerminalAbbrev === targetTerminal) {
      return segments;
    }
    current = current.NextKey ? byKey.get(current.NextKey) : undefined;
  }

  return targetTerminal ? null : segments;
};

/**
 * Formats segments for UI: add DisplayArrivingTerminalAbbrev and SchedArriveNext from next segment.
 *
 * @param segments - Raw chain segments
 * @returns Segments with DisplayArrivingTerminalAbbrev and SchedArriveNext set
 */
const formatSegments = (
  segments: ScheduledTrip[]
): ScheduledTripJourney["segments"] =>
  segments.map((s, idx) => {
    const next = segments[idx + 1];
    return {
      ...s,
      DisplayArrivingTerminalAbbrev:
        next?.DepartingTerminalAbbrev ?? s.ArrivingTerminalAbbrev,
      SchedArriveNext: next?.SchedArriveCurr ?? s.SchedArriveNext,
    };
  });

/**
 * Builds journey chains from flat scheduled segments.
 *
 * Simple walk-from-A-until-B model: find segments departing from terminalAbbrev,
 * traverse via NextKey until reaching destinationAbbrev (or end of chain).
 *
 * @param scheduledTrips - All domain segments for the route(s)
 * @param terminalAbbrev - Departure terminal (e.g. "P52")
 * @param destinationAbbrev - Optional destination; omit for "all from A"
 * @returns Sorted array of ScheduledTripJourney
 */
export const buildJourneyChains = (
  scheduledTrips: ScheduledTrip[],
  terminalAbbrev: string,
  destinationAbbrev?: string
): ScheduledTripJourney[] => {
  const byKey = new Map(scheduledTrips.map((t) => [t.Key, t]));

  const startingSegments = scheduledTrips
    .filter((t) => t.DepartingTerminalAbbrev === terminalAbbrev)
    .sort((a, b) => a.DepartingTime.getTime() - b.DepartingTime.getTime());

  const seen = new Set<string>();
  const toJourney = (chain: ScheduledTrip[]): ScheduledTripJourney => {
    const last = chain[chain.length - 1];
    return {
      id: last.Key,
      vesselAbbrev: last.VesselAbbrev,
      routeAbbrev: last.RouteAbbrev,
      departureTime: chain[0].DepartingTime.getTime(),
      segments: formatSegments(chain),
    };
  };

  return startingSegments
    .filter((seg) => {
      const key = `${seg.VesselAbbrev}:${seg.DepartingTime.getTime()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .flatMap((seg) => {
      const chain = walkUntil(seg, destinationAbbrev, byKey);
      return chain ? [toJourney(chain)] : [];
    })
    .sort((a, b) => a.departureTime - b.departureTime);
};
