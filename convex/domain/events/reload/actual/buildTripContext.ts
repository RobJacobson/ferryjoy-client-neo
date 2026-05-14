/**
 * Reduces active and completed reload trips into shared lookups.
 *
 * Actual-row construction builds this context once so trip-key joins,
 * physical-only filtering, and active physical-only lookups are derived from a
 * single pass over the input.
 */

import { definedRows } from "../shared";
import type {
  ReloadTripContext,
  ReloadTripForActuals,
  ReloadTripWithTripKey,
} from "../types";

/**
 * Builds the trip context used by actual-row source projections.
 *
 * Filters trips that carry a TripKey, indexes them by schedule segment key for
 * boundary joins, and isolates physical-only trips (those without ScheduleKey)
 * for fallback row emission.
 *
 * @param activeTrips - Active Convex trip rows contributing actual evidence
 * @param completedTrips - Completed Convex trip rows contributing actual evidence
 * @returns Trip context with lookups, physical-only collections, and preserve set
 */
const buildActualTripContext = (
  activeTrips: ReloadTripForActuals[],
  completedTrips: ReloadTripForActuals[]
): ReloadTripContext => {
  const activeTripsWithKeys = definedRows(activeTrips.map(toTripWithTripKey));
  const completedTripsWithKeys = definedRows(
    completedTrips.map(toTripWithTripKey)
  );
  const tripsWithKeys = [...activeTripsWithKeys, ...completedTripsWithKeys];

  const physicalOnlyTrips = tripsWithKeys.filter(isPhysicalOnlyTrip);
  const tripKeyBySegmentKey = buildTripKeyBySegmentKey(tripsWithKeys);
  const activePhysicalOnlyTripsByVessel =
    buildActivePhysicalOnlyTripsByVessel(activeTripsWithKeys);

  return {
    tripKeyBySegmentKey,
    physicalOnlyTrips,
    activePhysicalOnlyTripsByVessel,
  };
};

/**
 * Narrows a reload trip to rows that can be joined to actual dock evidence.
 *
 * @param trip - Reload trip row that may lack a TripKey
 * @returns Trip with required TripKey, or undefined when not joinable
 */
const toTripWithTripKey = (
  trip: ReloadTripForActuals
): ReloadTripWithTripKey | undefined =>
  trip.TripKey === undefined ? undefined : { ...trip, TripKey: trip.TripKey };

/**
 * Returns whether a reload trip row represents a physical-only sailing without schedule linkage.
 *
 * @param trip - Reload trip guaranteed to carry TripKey
 * @returns True when ScheduleKey is absent so joins use TripKey only
 */
const isPhysicalOnlyTrip = (trip: ReloadTripWithTripKey) =>
  trip.ScheduleKey === undefined;

/**
 * Maps schedule segment keys and TripKeys to canonical TripKey for joins.
 *
 * @param trips - Reload trips carrying TripKey and optional ScheduleKey
 * @returns Map keyed by ScheduleKey when present, otherwise TripKey maps to itself
 */
const buildTripKeyBySegmentKey = (
  trips: ReloadTripWithTripKey[]
): Map<string, string> => {
  const segmentOrTripKeyToTripKeyEntries = trips.map(
    (trip) => [trip.ScheduleKey ?? trip.TripKey, trip.TripKey] as const
  );
  const tripKeyBySegmentKey = new Map(segmentOrTripKeyToTripKeyEntries);

  return tripKeyBySegmentKey;
};

/**
 * Indexes active physical-only trips by vessel abbrev for live-location fallback.
 *
 * Later vessel wins when multiple active physical-only rows share a vessel,
 * matching Map last-write semantics used when building the map.
 *
 * @param trips - Active reload trips with TripKey
 * @returns Map from vessel abbrev to physical-only trip row
 */
const buildActivePhysicalOnlyTripsByVessel = (
  trips: ReloadTripWithTripKey[]
): Map<string, ReloadTripWithTripKey> => {
  const vesselAbbrevToPhysicalOnlyTripEntries = trips
    .filter(isPhysicalOnlyTrip)
    .map((trip) => [trip.VesselAbbrev, trip] as const);
  const activePhysicalOnlyTripsByVessel = new Map(
    vesselAbbrevToPhysicalOnlyTripEntries
  );

  return activePhysicalOnlyTripsByVessel;
};

export { buildActualTripContext };
