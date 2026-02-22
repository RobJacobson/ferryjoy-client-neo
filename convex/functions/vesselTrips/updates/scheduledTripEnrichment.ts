import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { ConvexScheduledTrip } from "functions/scheduledTrips/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { generateTripKey } from "shared/keys";
import { stripConvexMeta } from "shared/stripConvexMeta";

/**
 * Fields to clear when derived trip data is invalid.
 *
 * Used when:
 * 1. Key changes (trip identity changed): clear cached ScheduledTrip snapshot
 *    and prediction fields computed under old identity
 * 2. Repositioning (tripKey is null): vessel is between scheduled trips;
 *    clear stale data to prevent displaying wrong times
 */
const CLEAR_DERIVED_TRIP_DATA: Partial<ConvexVesselTrip> = {
  Key: undefined,
  RouteID: 0,
  RouteAbbrev: "",
  SailingDay: "",
  ScheduledTrip: undefined,
  AtDockDepartCurr: undefined,
  AtDockArriveNext: undefined,
  AtDockDepartNext: undefined,
  AtSeaArriveNext: undefined,
  AtSeaDepartNext: undefined,
};

/**
 * Derive the composite trip key from an active vessel trip.
 *
 * The key is only derivable once we have:
 * - `ScheduledDeparture` (for date/time in Pacific)
 * - `DepartingTerminalAbbrev`
 * - `ArrivingTerminalAbbrev`
 *
 * @param trip - Active vessel trip with required fields for key derivation
 * @returns Composite trip key string or null if required fields are missing
 */
const deriveTripKey = (trip: ConvexVesselTrip): string | null => {
  if (
    !trip.ScheduledDeparture ||
    !trip.DepartingTerminalAbbrev ||
    !trip.ArrivingTerminalAbbrev
  ) {
    return null;
  }

  return (
    generateTripKey(
      trip.VesselAbbrev,
      trip.DepartingTerminalAbbrev,
      trip.ArrivingTerminalAbbrev,
      new Date(trip.ScheduledDeparture)
    ) ?? null
  );
};

/**
 * Decide whether we should attempt to look up the ScheduledTrip snapshot.
 *
 * We look up when:
 * - the key is missing or changed (critical; we must resync)
 * - or we don't have scheduled data yet, with a light throttle to avoid
 *   hammering the DB on every update tick.
 *
 * @param trip - Current vessel trip state
 * @param tripKey - Computed trip key for lookup
 * @returns Object indicating whether to lookup and if there's a key mismatch
 */
const shouldLookupScheduledTrip = (
  trip: ConvexVesselTrip,
  tripKey: string
): { shouldLookup: boolean; existingKeyMismatch: boolean } => {
  const existingKeyMismatch = trip.Key !== undefined && trip.Key !== tripKey;
  const hasExistingKey = trip.Key !== undefined;

  if (existingKeyMismatch || !hasExistingKey) {
    return { shouldLookup: true, existingKeyMismatch };
  }

  const hasScheduledTripData =
    trip.ScheduledTrip !== undefined && trip.RouteID !== 0;
  const seconds = new Date().getSeconds();
  return {
    shouldLookup: !hasScheduledTripData && seconds < 5,
    existingKeyMismatch,
  };
};

/**
 * Fetch the ScheduledTrip for a given key and return fields to merge into the trip.
 *
 * Stores a snapshot copy (`ScheduledTrip`) for debugging/explainability and
 * denormalizes RouteID, RouteAbbrev, SailingDay at the top level.
 *
 * Safety check: Only matches direct trips. Indirect trips have different terminal
 * pairs (A->C vs A->B), so they have different keys and won't match.
 *
 * @param ctx - Convex action context for database queries
 * @param tripKey - Composite trip key to lookup ScheduledTrip
 * @returns ScheduledTrip-derived fields to merge, or null if not found or indirect
 */
const fetchScheduledTripFieldsByKey = async (
  ctx: ActionCtx,
  tripKey: string
): Promise<Partial<ConvexVesselTrip> | null> => {
  const scheduledTripDoc = await ctx.runQuery(
    api.functions.scheduledTrips.queries.getScheduledTripByKey,
    { key: tripKey }
  );

  if (!scheduledTripDoc) {
    return null;
  }

  const scheduledTrip = stripConvexMeta(scheduledTripDoc);

  // Safety check: Only use direct trips for VesselTrips
  // Indirect trips have different keys (different terminal pairs), so this
  // should never happen, but we check defensively.
  // We only warn if the trip is indirect, as this indicates the lookup found
  // an indirect trip for a key that we expected to be direct.
  if (scheduledTrip.TripType === "indirect") {
    return null;
  }

  return {
    ScheduledTrip: scheduledTrip,
    RouteID: scheduledTrip.RouteID,
    RouteAbbrev: scheduledTrip.RouteAbbrev,
    SailingDay: scheduledTrip.SailingDay,
  } as Partial<ConvexVesselTrip>;
};

/**
 * Extract ScheduledTrip-derived fields from a scheduled trip doc.
 *
 * @param scheduledTrip - Scheduled trip document
 * @returns Fields to merge: ScheduledTrip, RouteID, RouteAbbrev, SailingDay
 */
const scheduledTripToPatch = (
  scheduledTrip: ConvexScheduledTrip
): Partial<ConvexVesselTrip> => ({
  ScheduledTrip: scheduledTrip,
  RouteID: scheduledTrip.RouteID,
  RouteAbbrev: scheduledTrip.RouteAbbrev,
  SailingDay: scheduledTrip.SailingDay,
});

/**
 * Enrich a trip with Key + ScheduledTrip snapshot (schedule-derived fields).
 *
 * Keeps `Key` in sync with current trip identity; looks up ScheduledTrip when
 * appropriate or uses cached doc. Clears stale derived data when key changes.
 *
 * When `cachedScheduledTrip` is provided and its Key matches the derived tripKey,
 * uses it instead of calling getScheduledTripByKey—eliminating one query per vessel
 * when arrival lookup already returned the same scheduled trip.
 *
 * @param ctx - Convex action context for database operations
 * @param updatedTrip - Current vessel trip state to enrich
 * @param cachedScheduledTrip - Optional scheduled trip from arrival lookup (avoids second query)
 * @returns Schedule-derived fields to merge into the trip (Key, RouteID, RouteAbbrev, SailingDay, ScheduledTrip, or cleared state)
 */
export const enrichTripStartUpdates = async (
  ctx: ActionCtx,
  updatedTrip: ConvexVesselTrip,
  cachedScheduledTrip?: ConvexScheduledTrip
): Promise<Partial<ConvexVesselTrip>> => {
  const tripKey = deriveTripKey(updatedTrip);

  if (!tripKey) {
    // When tripKey is null (e.g., during repositioning), clear stale Key and ScheduledTrip data.
    // Always return cleared state; tripsAreEqual handles "no change" when already cleared.
    return CLEAR_DERIVED_TRIP_DATA;
  }

  const { shouldLookup, existingKeyMismatch } = shouldLookupScheduledTrip(
    updatedTrip,
    tripKey
  );

  // If we can compute a key, keep it in sync even if we don't look up yet.
  const keyPatch: Partial<ConvexVesselTrip> =
    updatedTrip.Key === tripKey ? {} : { Key: tripKey };
  const invalidationPatch = existingKeyMismatch ? CLEAR_DERIVED_TRIP_DATA : {};

  // Use cached scheduled trip from arrival lookup when key matches (avoids second query).
  if (cachedScheduledTrip && cachedScheduledTrip.Key === tripKey) {
    if (cachedScheduledTrip.TripType === "indirect") {
      return { ...keyPatch, ...invalidationPatch };
    }
    return {
      ...scheduledTripToPatch(cachedScheduledTrip),
      ...keyPatch,
    };
  }

  // Key is correct, and we either already have data or we're throttling.
  if (!shouldLookup) {
    return keyPatch;
  }

  // Attempt lookup. If it fails, keep key in sync and optionally invalidate.
  try {
    const scheduledTrip = await fetchScheduledTripFieldsByKey(ctx, tripKey);
    if (scheduledTrip) {
      return {
        ...scheduledTrip,
        ...keyPatch,
      };
    }
  } catch (_error) {
    return {
      ...keyPatch,
      ...invalidationPatch,
    };
  }

  return {
    ...keyPatch,
    ...invalidationPatch,
  };
};
