/**
 * Reduces active and completed reload trips into shared lookups.
 *
 * The orchestrator builds this context once before scheduled and actual stages
 * run so trip-key joins, physical-only filtering, and the preserve set are
 * derived from a single pass over the input. Downstream stages take the
 * structured context instead of repeatedly walking the raw trip arrays.
 */

import { definedRows } from "./collectionHelpers";
import type {
  ReloadTripContext,
  ReloadTripForActuals,
  ReloadTripWithTripKey,
} from "./types";

/**
 * Builds the trip context shared across scheduled and actual pipeline stages.
 *
 * Filters trips that carry a TripKey, indexes them by schedule segment key for
 * boundary joins, isolates physical-only trips (those without ScheduleKey) for
 * fallback row emission, and records their TripKeys so the actual replacement
 * mutation does not delete rows that have no scheduled counterpart.
 *
 * @param activeTrips - Active Convex trip rows contributing actual evidence
 * @param completedTrips - Completed Convex trip rows contributing actual evidence
 * @returns Trip context with lookups, physical-only collections, and preserve set
 */
const buildReloadTripContext = (
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
  const physicalOnlyTripKeysToPreserve = new Set(
    physicalOnlyTrips.map(toTripKey)
  );

  return {
    tripKeyBySegmentKey,
    physicalOnlyTrips,
    activePhysicalOnlyTripsByVessel,
    physicalOnlyTripKeysToPreserve,
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

/**
 * Reads TripKey from a reload trip row typed with required TripKey.
 *
 * @param trip - Reload trip row with TripKey populated
 * @returns Same TripKey string for set building and filtering
 */
const toTripKey = (trip: ReloadTripWithTripKey) => trip.TripKey;

export { buildReloadTripContext };
