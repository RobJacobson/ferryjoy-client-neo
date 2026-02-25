/**
 * Scheduled trip lookup - enriches trip with schedule data.
 *
 * Takes base trip (Key from baseTripFromLocation), performs I/O-conditioned
 * lookup by Key. Sets scheduledTripId reference when found.
 * Clears stale predictions when Key is undefined (repositioning) or key changed.
 */
import { api, internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

// ============================================================================
// appendInitialSchedule
// ============================================================================

/**
 * Look up arriving terminal when vessel just arrived at dock.
 *
 * Performs heuristic lookup using VesselAbbrev, DepartingTerminalAbbrev,
 * and ScheduledDeparture. Returns trip with ArrivingTerminalAbbrev
 * and scheduledTripId if found.
 *
 * @param ctx - Convex action context for database queries
 * @param baseTrip - Current trip state (from baseTripFromLocation)
 * @returns Trip enriched with arrival terminal and scheduled trip ID if lookup succeeds
 */
export const appendInitialSchedule = async (
  ctx: ActionCtx,
  baseTrip: ConvexVesselTrip
): Promise<ConvexVesselTrip> => {
  const scheduledDeparture = baseTrip.ScheduledDeparture;

  // Missing required fields - can't lookup
  if (
    !baseTrip.VesselAbbrev ||
    !baseTrip.DepartingTerminalAbbrev ||
    !scheduledDeparture
  ) {
    return baseTrip;
  }

  const lookupArgs = {
    vesselAbbrev: baseTrip.VesselAbbrev,
    departingTerminalAbbrev: baseTrip.DepartingTerminalAbbrev,
    scheduledDeparture,
  };

  const scheduledTrip = await ctx.runQuery(
    api.functions.scheduledTrips.queries.findScheduledTripForArrivalLookup,
    lookupArgs
  );

  const result = {
    ...baseTrip,
    Key: scheduledTrip?.Key,
    ArrivingTerminalAbbrev: scheduledTrip?.ArrivingTerminalAbbrev,
    scheduledTripId: scheduledTrip?._id,
  };
  return result;
};

// ============================================================================
// appendFinalSchedule
// ============================================================================

/**
 * Look up scheduled trip using deterministic key and set scheduledTripId reference.
 *
 * Performs lookup when called by buildTrip (which handles event detection).
 * Reuses existing scheduledTripId when appropriate.
 * Clears predictions when key invalid or missing.
 *
 * @param ctx - Convex action context for database queries
 * @param baseTrip - Trip from baseTripFromLocation (has Key when derivable)
 * @param existingTrip - Previous trip (for reuse), undefined for first trip
 * @returns Trip enriched with scheduledTripId if lookup succeeds
 */
export const appendFinalSchedule = async (
  ctx: ActionCtx,
  baseTrip: ConvexVesselTrip,
  existingTrip: ConvexVesselTrip | undefined
): Promise<ConvexVesselTrip> => {
  const tripKey = baseTrip.Key ?? null;

  if (!tripKey) {
    return baseTrip;
  }

  // Reuse existing scheduledTripId if key hasn't changed
  if (existingTrip?.scheduledTripId && existingTrip.Key === tripKey) {
    return { ...baseTrip, scheduledTripId: existingTrip.scheduledTripId };
  }

  // Perform lookup
  const scheduledTripId = await ctx.runQuery(
    internal.functions.scheduledTrips.queries.getScheduledTripIdByKey,
    { key: tripKey }
  );

  const result = {
    ...baseTrip,
    scheduledTripId: scheduledTripId ?? baseTrip.scheduledTripId,
  };
  return result;
};
