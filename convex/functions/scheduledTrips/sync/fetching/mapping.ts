import type { RawWsfScheduleSegment } from "shared/fetchWsfScheduleData";
import { buildScheduleSegmentKey } from "shared/keys";
import { buildInitialScheduledTripRow } from "../../../../domain/scheduledTrips/buildInitialScheduledTripRow";
import { resolveScheduleSegmentIdentity } from "../../../../shared/scheduleIdentity";
import type { VesselIdentity } from "../../../../shared/vessels";
import type { TerminalIdentity } from "../../../terminals/resolver";
import type { ConvexScheduledTrip } from "../../schemas";

/**
 * Resolves all required abbreviations for a raw schedule segment, rejecting if
 * any are missing.
 */
export const resolveTripAbbreviations = (
  segment: RawWsfScheduleSegment,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): {
  vesselAbbrev: string;
  departingTerminalAbbrev: string;
  arrivingTerminalAbbrev: string;
} | null => {
  const resolvedIdentity = resolveScheduleSegmentIdentity(
    segment,
    vessels,
    terminals
  );

  if (!resolvedIdentity) {
    console.warn(`Skipping trip due to missing abbreviations:`, {
      vessel: segment.VesselName,
      departing: segment.DepartingTerminalName,
      arriving: segment.ArrivingTerminalName,
    });
    return null;
  }

  return resolvedIdentity;
};

/**
 * Creates a complete scheduled trip record from a neutral raw schedule segment.
 *
 * @param segment - Raw schedule segment derived from WSF API data
 * @returns Complete scheduled trip record ready for Convex storage, or null if invalid
 */
export const createScheduledTripFromRawSegment = (
  segment: RawWsfScheduleSegment,
  vessels: ReadonlyArray<VesselIdentity>,
  terminals: ReadonlyArray<TerminalIdentity>
): ConvexScheduledTrip | null => {
  const abbreviations = resolveTripAbbreviations(segment, vessels, terminals);

  if (!abbreviations) return null;

  const { vesselAbbrev, departingTerminalAbbrev, arrivingTerminalAbbrev } =
    abbreviations;

  // Generate the composite key that uniquely identifies this trip
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
    ArrivingTime: segment.ArrivingTime
      ? segment.ArrivingTime.getTime()
      : undefined,
    SailingNotes: segment.SailingNotes,
    Annotations: segment.Annotations,
    RouteID: segment.RouteID,
    RouteAbbrev: segment.RouteAbbrev,
    SailingDay: segment.SailingDay,
  });
};
