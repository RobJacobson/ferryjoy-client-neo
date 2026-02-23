/**
 * Trip enrichment utilities - location, schedule, and predictions.
 *
 * Consolidates location-derived field construction, scheduled trip enrichment,
 * and arrival terminal lookup into unified pipeline.
 */
import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { ConvexScheduledTrip } from "functions/scheduledTrips/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { calculateTimeDelta } from "shared/durationUtils";
import { generateTripKey } from "shared/keys";
import { stripConvexMeta } from "shared/stripConvexMeta";
import { getSailingDay } from "shared/time";

// ============================================================================
// Types
// ============================================================================

export type ArrivalLookupResult = {
  arrivalTerminal?: string;
  scheduledTripDoc?: ConvexScheduledTrip;
};

// ============================================================================
// Arrival Terminal Lookup
// ============================================================================

/**
 * Look up arriving terminal from scheduled trips when vessel arrives at dock
 * without an identified arriving terminal.
 *
 * Matches scheduled trips based on:
 * - Vessel name (VesselAbbrev)
 * - Departing terminal (DepartingTerminalAbbrev)
 * - Scheduled departure (ScheduledDeparture)
 * - Prefers direct trips if both direct and indirect trips match
 *
 * When a match is found, returns both the arriving terminal and the full
 * scheduled trip doc. The caller can reuse the scheduled trip for
 * enrichTripStartUpdates to avoid a second query (getScheduledTripByKey).
 *
 * @param ctx - Convex action context for database queries
 * @param tripForLookup - Trip state for lookup (existing trip or newly created)
 * @param currLocation - Latest vessel location data
 * @returns Arrival terminal and optional scheduled trip doc, or undefined
 */
export const lookupArrivalTerminalFromSchedule = async (
  ctx: ActionCtx,
  tripForLookup: ConvexVesselTrip,
  currLocation: ConvexVesselLocation
): Promise<ArrivalLookupResult | undefined> => {
  // Only lookup when:
  // 1. Vessel is currently at dock
  // 2. Arriving terminal is missing (both in trip and current location)
  // 3. We have the required fields for lookup
  const isAtDock = currLocation.AtDock;
  const missingArrivingTerminal =
    !tripForLookup.ArrivingTerminalAbbrev &&
    !currLocation.ArrivingTerminalAbbrev;
  const hasRequiredFields =
    tripForLookup.VesselAbbrev &&
    tripForLookup.DepartingTerminalAbbrev &&
    tripForLookup.ScheduledDeparture;

  if (!isAtDock || !missingArrivingTerminal || !hasRequiredFields) {
    return undefined;
  }

  const queryParams = {
    vesselAbbrev: tripForLookup.VesselAbbrev,
    departingTerminalAbbrev: tripForLookup.DepartingTerminalAbbrev,
    // biome-ignore lint/style/noNonNullAssertion: hasRequiredFields ensures ScheduledDeparture is defined
    scheduledDeparture: tripForLookup.ScheduledDeparture!,
  };

  try {
    const scheduledTrip = await ctx.runQuery(
      api.functions.scheduledTrips.queries.findScheduledTripForArrivalLookup,
      queryParams
    );

    if (scheduledTrip) {
      const trip = stripConvexMeta(
        scheduledTrip as Record<string, unknown>
      ) as ConvexScheduledTrip;
      return {
        arrivalTerminal: trip.ArrivingTerminalAbbrev,
        scheduledTripDoc: trip,
      };
    }
  } catch (error) {
    console.error(
      `[ArrivalTerminalLookup] Failed to lookup arrival terminal for vessel ${tripForLookup.VesselAbbrev}:`,
      error
    );
  }

  return undefined;
};

// ============================================================================
// Location-Derived Field Construction
// ============================================================================

/**
 * Build complete VesselTrip from existing trip and current location.
 *
 * Used by the build-then-compare refactor for the regular update path (same trip,
 * no boundary). Resolves all location-derived fields per Field Reference 2.6.
 *
 * @param existingTrip - Current vessel trip state (same trip, prior tick)
 * @param currLocation - Latest vessel location from REST/API
 * @param arrivalLookup - Optional result from lookupArrivalTerminalFromSchedule
 * @returns Complete ConvexVesselTrip with all location-derived fields
 */
export const buildCompleteTrip = (
  existingTrip: ConvexVesselTrip,
  currLocation: ConvexVesselLocation,
  arrivalLookup?: ArrivalLookupResult
): ConvexVesselTrip => {
  const atDockFlippedToFalse =
    currLocation.AtDock !== existingTrip.AtDock &&
    !currLocation.AtDock &&
    existingTrip.AtDock;

  // LeftDock: special case when AtDock flips false and LeftDock missing
  const leftDock =
    atDockFlippedToFalse && !existingTrip.LeftDock
      ? (currLocation.LeftDock ?? currLocation.TimeStamp)
      : (currLocation.LeftDock ?? existingTrip.LeftDock);

  const scheduledDeparture =
    currLocation.ScheduledDeparture ?? existingTrip.ScheduledDeparture;
  const eta = currLocation.Eta ?? existingTrip.Eta;

  const tripDelay = calculateTimeDelta(scheduledDeparture, leftDock);
  const atDockDuration = calculateTimeDelta(existingTrip.TripStart, leftDock);

  // Derive SailingDay from TripStart using WSF sailing day logic
  const sailingDay = existingTrip.TripStart
    ? getSailingDay(new Date(existingTrip.TripStart))
    : "";

  return {
    ...existingTrip,
    VesselAbbrev: currLocation.VesselAbbrev,
    DepartingTerminalAbbrev: currLocation.DepartingTerminalAbbrev,
    ArrivingTerminalAbbrev:
      currLocation.ArrivingTerminalAbbrev ??
      arrivalLookup?.arrivalTerminal ??
      existingTrip.ArrivingTerminalAbbrev,
    AtDock: currLocation.AtDock,
    InService: currLocation.InService,
    TimeStamp: currLocation.TimeStamp,
    ScheduledDeparture: scheduledDeparture,
    Eta: eta,
    LeftDock: leftDock,
    TripDelay: tripDelay ?? existingTrip.TripDelay,
    AtDockDuration: atDockDuration ?? existingTrip.AtDockDuration,
    SailingDay: sailingDay,
  };
};

// ============================================================================
// Scheduled Trip Enrichment
// ============================================================================

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
 * Fetch ScheduledTrip for a given key and return fields to merge into trip.
 *
 * Stores a snapshot copy (`ScheduledTrip`) for debugging/explainability and
 * denormalizes RouteID, RouteAbbrev, SailingDay at the top level.
 *
 * @param ctx - Convex action context for database queries
 * @param tripKey - Composite trip key to lookup ScheduledTrip
 * @returns ScheduledTrip-derived fields to merge, or null if not found
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
  if (scheduledTrip.TripType === "indirect") {
    return null;
  }

  return {
    ScheduledTrip: scheduledTrip,
  } as Partial<ConvexVesselTrip>;
};

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
  const tripKey =
    generateTripKey(
      updatedTrip.VesselAbbrev,
      updatedTrip.DepartingTerminalAbbrev,
      updatedTrip.ArrivingTerminalAbbrev,
      updatedTrip.ScheduledDeparture
        ? new Date(updatedTrip.ScheduledDeparture)
        : undefined
    ) ?? null;

  // Early return: no key means repositioning
  if (!tripKey) {
    return CLEAR_DERIVED_TRIP_DATA;
  }

  // Compute patches
  const keyPatch: Partial<ConvexVesselTrip> =
    updatedTrip.Key === tripKey ? {} : { Key: tripKey };
  const invalidationPatch =
    updatedTrip.Key !== undefined && updatedTrip.Key !== tripKey
      ? CLEAR_DERIVED_TRIP_DATA
      : {};

  // Use cached scheduled trip if key matches
  if (cachedScheduledTrip?.Key === tripKey) {
    const sailingDay = updatedTrip.ScheduledDeparture
      ? getSailingDay(new Date(updatedTrip.ScheduledDeparture))
      : "";
    return {
      ScheduledTrip: cachedScheduledTrip,
      SailingDay: sailingDay,
      ...keyPatch,
    };
  }

  // Determine if we need to lookup
  const hasScheduledTripData =
    updatedTrip.ScheduledTrip !== undefined && updatedTrip.RouteID !== 0;
  const shouldLookup =
    keyPatch.Key !== undefined || !updatedTrip.Key || !hasScheduledTripData;

  if (!shouldLookup) {
    return keyPatch;
  }

  // Fetch scheduled trip
  try {
    const scheduledTrip = await fetchScheduledTripFieldsByKey(ctx, tripKey);
    return scheduledTrip
      ? { ...scheduledTrip, ...keyPatch }
      : { ...keyPatch, ...invalidationPatch };
  } catch {
    return { ...keyPatch, ...invalidationPatch };
  }
};
