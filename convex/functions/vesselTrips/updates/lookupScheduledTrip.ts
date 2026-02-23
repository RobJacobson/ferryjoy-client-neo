/**
 * Scheduled trip lookup - returns trip with schedule data merged.
 *
 * Takes base trip (Key from buildTripFromRawData), performs I/O-conditioned
 * lookup by Key, and returns the complete trip with RouteID, RouteAbbrev,
 * ScheduledTrip merged. Clears stale predictions when Key is undefined
 * (repositioning) or key changed.
 */
import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { ConvexScheduledTrip } from "functions/scheduledTrips/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { stripConvexMeta } from "shared/stripConvexMeta";

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
 * When a match is found, returns both the arriving terminal and the full
 * scheduled trip doc. The caller can pass scheduledTripDoc to
 * lookupScheduledTrip to avoid a second query.
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
  // If not at dock, we don't need to lookup arrival terminal
  if (!currLocation.AtDock) {
    return undefined;
  }

  // Only lookup when we're missing the arriving terminal (query infers it)
  if (
    tripForLookup.ArrivingTerminalAbbrev ||
    currLocation.ArrivingTerminalAbbrev
  ) {
    return undefined;
  }

  // If we are missing the required fields, we can't lookup the scheduled trip
  if (
    !tripForLookup.VesselAbbrev ||
    !tripForLookup.DepartingTerminalAbbrev ||
    !tripForLookup.ScheduledDeparture
  ) {
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
// lookupScheduledTrip
// ============================================================================

/** Prediction fields to clear when repositioning or key changed (stale from old trip) */
const CLEARED_PREDICTIONS: Partial<ConvexVesselTrip> = {
  AtDockDepartCurr: undefined,
  AtDockArriveNext: undefined,
  AtDockDepartNext: undefined,
  AtSeaArriveNext: undefined,
  AtSeaDepartNext: undefined,
};

/**
 * Look up scheduled trip and return base trip with schedule data merged.
 *
 * Takes base trip (Key from buildTripFromRawData), performs I/O-conditioned
 * lookup, and returns the complete trip. When baseTrip.Key is undefined
 * (repositioning) or lookup fails, returns trip with cleared schedule fields.
 * When key changed from previous trip, clears stale schedule data.
 *
 * @param ctx - Convex action context for database queries
 * @param baseTrip - Trip from buildTripFromRawData (has Key when derivable)
 * @param cachedScheduledTrip - Optional scheduled trip from arrival lookup
 * @param existingTrip - Previous trip (for key-changed detection; undefined for first/boundary)
 * @returns Trip with RouteID, RouteAbbrev, ScheduledTrip merged
 */
export const lookupScheduledTrip = async (
  ctx: ActionCtx,
  baseTrip: ConvexVesselTrip,
  cachedScheduledTrip?: ConvexScheduledTrip,
  existingTrip?: ConvexVesselTrip
): Promise<ConvexVesselTrip> => {
  const tripKey = baseTrip.Key ?? null;

  if (!tripKey) {
    return { ...baseTrip, ...CLEARED_PREDICTIONS };
  }

  const keyChanged =
    existingTrip?.Key !== undefined && baseTrip.Key !== existingTrip.Key;

  // Use cached scheduled trip if key matches (from arrival lookup)
  if (cachedScheduledTrip?.Key === tripKey) {
    return {
      ...baseTrip,
      RouteID: cachedScheduledTrip.RouteID,
      RouteAbbrev: cachedScheduledTrip.RouteAbbrev,
      ScheduledTrip: cachedScheduledTrip,
    };
  }

  // Skip lookup if we already have schedule data for this key (from previous tick)
  if (
    existingTrip?.Key === tripKey &&
    existingTrip?.ScheduledTrip &&
    existingTrip?.RouteID
  ) {
    return {
      ...baseTrip,
      RouteID: existingTrip.RouteID,
      RouteAbbrev: existingTrip.RouteAbbrev,
      ScheduledTrip: existingTrip.ScheduledTrip,
    };
  }

  try {
    const scheduledTripDoc = await ctx.runQuery(
      api.functions.scheduledTrips.queries.getScheduledTripByKey,
      { key: tripKey }
    );

    if (!scheduledTripDoc) {
      return keyChanged ? { ...baseTrip, ...CLEARED_PREDICTIONS } : baseTrip;
    }

    const scheduledTrip = stripConvexMeta(scheduledTripDoc);

    return {
      ...baseTrip,
      RouteID: scheduledTrip.RouteID,
      RouteAbbrev: scheduledTrip.RouteAbbrev,
      ScheduledTrip: scheduledTrip as ConvexScheduledTrip,
    };
  } catch {
    return keyChanged ? { ...baseTrip, ...CLEARED_PREDICTIONS } : baseTrip;
  }
};
