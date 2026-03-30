import type { RawWsfScheduleSegment } from "shared/fetchWsfScheduleData";
import { generateTripKey } from "shared/keys";
import type { ConvexScheduledTrip } from "../../schemas";
import { getTerminalAbbreviation, getVesselAbbreviation } from "../../schemas";

/**
 * Resolves all required abbreviations for a raw schedule segment, rejecting if
 * any are missing.
 */
export const resolveTripAbbreviations = (
  segment: RawWsfScheduleSegment
): {
  vesselAbbrev: string;
  departingTerminalAbbrev: string;
  arrivingTerminalAbbrev: string;
} | null => {
  const vesselAbbrev = getVesselAbbreviation(segment.VesselName);
  const departingTerminalAbbrev = getTerminalAbbreviation(
    segment.DepartingTerminalName
  );
  const arrivingTerminalAbbrev = getTerminalAbbreviation(
    segment.ArrivingTerminalName
  );

  if (!vesselAbbrev || !departingTerminalAbbrev || !arrivingTerminalAbbrev) {
    console.warn(`Skipping trip due to missing abbreviations:`, {
      vessel: segment.VesselName,
      departing: segment.DepartingTerminalName,
      arriving: segment.ArrivingTerminalName,
    });
    return null;
  }

  return { vesselAbbrev, departingTerminalAbbrev, arrivingTerminalAbbrev };
};

/**
 * Creates a complete scheduled trip record from a neutral raw schedule segment.
 *
 * @param segment - Raw schedule segment derived from WSF API data
 * @returns Complete scheduled trip record ready for Convex storage, or null if invalid
 */
export const createScheduledTripFromRawSegment = (
  segment: RawWsfScheduleSegment
): ConvexScheduledTrip | null => {
  const abbreviations = resolveTripAbbreviations(segment);

  if (!abbreviations) return null;

  const { vesselAbbrev, departingTerminalAbbrev, arrivingTerminalAbbrev } =
    abbreviations;

  // Generate the composite key that uniquely identifies this trip
  const key = generateTripKey(
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

  const trip: ConvexScheduledTrip = {
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
    Key: key,
    SailingDay: segment.SailingDay,
    // TripType will be set correctly by direct-segment classification during sync
    // Default to "direct" as most trips are direct; classification will correct this
    TripType: "direct",
  };

  // Route 9 (Anacortes Island) has WSF-provided arrival times that we use as official times.
  // For other routes, SchedArriveCurr/SchedArriveNext are backfilled during sync.
  if (trip.RouteID === 9 && trip.ArrivingTime) {
    trip.SchedArriveCurr = trip.ArrivingTime;
  }

  return trip;
};
