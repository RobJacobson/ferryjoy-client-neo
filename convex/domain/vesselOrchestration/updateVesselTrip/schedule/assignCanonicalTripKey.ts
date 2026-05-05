/**
 * Assigns canonical TripKey on active vessel trips after schedule merge.
 *
 * TripKey matches the schedule segment string from buildSegmentKey whenever
 * geometry is known. WSF-complete pings always recompute TripKey from feed
 * fields so inferred schedule can be corrected when better data arrives.
 */

import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { buildSegmentKey } from "shared/keys";
import { hasWsfScheduleFields } from "./activeTripSchedule/resolveScheduleFromWsfRealtime";

type AssignCanonicalTripKeyArgs = {
  mergedTrip: ConvexVesselTrip;
  prevTrip: ConvexVesselTrip | undefined;
  currLocation: ConvexVesselLocation;
};

/**
 * Sets TripKey on the merged active trip row using segment identity when
 * possible, otherwise carries forward prior TripKey or the provisional TripKey
 * already on the merged row when geometry is still incomplete.
 *
 * @param args.mergedTrip - Active row after schedule enrichment (or raw build)
 * @param args.prev - Stored active trip for this vessel when continuing
 * @param args.location - Current vessel location ping
 * @returns Merged trip with TripKey set; same reference as mergedTrip when the
 *   resolved TripKey equals the incoming TripKey
 */
export const assignCanonicalTripKey = ({
  mergedTrip,
  prevTrip: prev,
  currLocation: location,
}: AssignCanonicalTripKeyArgs): ConvexVesselTrip => {
  const nextKey = resolveCanonicalTripKey({
    mergedTrip,
    prevTrip: prev,
    currLocation: location,
  });
  if (nextKey === mergedTrip.TripKey) {
    return mergedTrip;
  }
  return { ...mergedTrip, TripKey: nextKey };
};

/**
 * Resolves the canonical TripKey string for one ping.
 *
 * @param args.mergedTrip - Active row after optional schedule merge
 * @param args.prevTrip - Prior stored active trip when present
 * @param args.currLocation - Current ping driving identity rules
 * @returns Stable TripKey string for persistence
 */
const resolveCanonicalTripKey = ({
  mergedTrip,
  prevTrip,
  currLocation,
}: AssignCanonicalTripKeyArgs): string => {
  const segmentKey = hasWsfScheduleFields(currLocation)
    ? buildSegmentKey(
        currLocation.VesselAbbrev,
        currLocation.DepartingTerminalAbbrev,
        currLocation.ArrivingTerminalAbbrev,
        new Date(currLocation.ScheduledDeparture)
      )
    : undefined;
  return (
    segmentKey ??
    mergedTrip.ScheduleKey ??
    prevTrip?.TripKey ??
    mergedTrip.TripKey
  );
};
