/**
 * Maps a raw WSF schedule segment into a persistence-ready scheduled trip row.
 */

import type { RawWsfScheduleSegment } from "adapters/fetch/fetchWsfScheduledTripsTypes";
import { resolveScheduleSegment } from "adapters/resolve/resolveWsfScheduleSegment";
import { buildInitialScheduledTripRow } from "domain/scheduledTrips/buildInitialScheduledTripRow";
import type { ConvexScheduledTrip } from "functions/scheduledTrips/schemas";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import { buildScheduleSegmentKey } from "shared/keys";

/**
 * Creates a scheduled-trip row from a raw WSF schedule segment.
 *
 * @param segment - Raw WSF schedule segment from the adapter fetch pipeline
 * @param vessels - Backend vessel identity rows
 * @param terminals - Backend terminal identity rows
 * @returns Persistence-ready scheduled trip row, or `null` when identity resolution fails
 * @throws Error when the segment resolves but cannot produce a stable schedule key
 */
export const createScheduledTripFromRawSegment = (
  segment: RawWsfScheduleSegment,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): ConvexScheduledTrip | null => {
  const resolvedSegment = resolveScheduleSegment(segment, vessels, terminals);

  if (!resolvedSegment) {
    console.warn("Skipping trip because segment identity could not resolve:", {
      vessel: segment.VesselName,
      departing: segment.DepartingTerminalName,
      arriving: segment.ArrivingTerminalName,
    });
    return null;
  }

  const vesselAbbrev = resolvedSegment.vessel.VesselAbbrev;
  const departingTerminalAbbrev =
    resolvedSegment.departingTerminal.TerminalAbbrev;
  const arrivingTerminalAbbrev =
    resolvedSegment.arrivingTerminal.TerminalAbbrev;
  const key = buildScheduleSegmentKey(
    vesselAbbrev,
    departingTerminalAbbrev,
    arrivingTerminalAbbrev,
    segment.DepartingTime
  );

  if (!key) {
    throw new Error(
      `Failed to generate key for scheduled trip: ${vesselAbbrev}-${departingTerminalAbbrev}-${arrivingTerminalAbbrev}`
    );
  }

  return buildInitialScheduledTripRow({
    Key: key,
    VesselAbbrev: vesselAbbrev,
    DepartingTerminalAbbrev: departingTerminalAbbrev,
    ArrivingTerminalAbbrev: arrivingTerminalAbbrev,
    DepartingTime: segment.DepartingTime.getTime(),
    ArrivingTime: segment.ArrivingTime?.getTime(),
    SailingNotes: segment.SailingNotes,
    Annotations: segment.Annotations,
    RouteID: segment.RouteID,
    RouteAbbrev: segment.RouteAbbrev,
    SailingDay: segment.SailingDay,
  });
};
