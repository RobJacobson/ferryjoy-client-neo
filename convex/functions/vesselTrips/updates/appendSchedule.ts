/**
 * Scheduled trip lookup - enriches trip with schedule data.
 *
 * Takes base trip (Key from baseTripFromLocation) and performs I/O-conditioned
 * lookup by Key. Schedule data is resolved lazily by Key rather than persisted
 * as a ScheduledTrips document ID.
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
 * and next scheduled departure when lookup succeeds.
 *
 * @param ctx - Convex action context for database queries
 * @param baseTrip - Current trip state (from baseTripFromLocation)
 * @returns Trip enriched with arrival terminal and next departure if lookup succeeds
 */
export const appendInitialSchedule = async (
  ctx: ActionCtx,
  baseTrip: ConvexVesselTrip
): Promise<ConvexVesselTrip> => {
  const scheduledDeparture = baseTrip.ScheduledDeparture;

  // Missing required fields - cannot perform lookup
  if (
    !baseTrip.VesselAbbrev ||
    !baseTrip.DepartingTerminalAbbrev ||
    !scheduledDeparture
  ) {
    return baseTrip;
  }

  // Build lookup arguments for heuristic search
  const lookupArgs = {
    vesselAbbrev: baseTrip.VesselAbbrev,
    departingTerminalAbbrev: baseTrip.DepartingTerminalAbbrev,
    scheduledDeparture,
  };

  const scheduledTrip = await ctx.runQuery(
    api.functions.scheduledTrips.queries.findScheduledTripForArrivalLookup,
    lookupArgs
  );

  // Enrich trip with arrival terminal and next departure from schedule match
  const result = {
    ...baseTrip,
    Key: scheduledTrip?.Key,
    ArrivingTerminalAbbrev: scheduledTrip?.ArrivingTerminalAbbrev,
    NextScheduledDeparture: scheduledTrip?.NextDepartingTime,
  };
  return result;
};

// ============================================================================
// appendFinalSchedule
// ============================================================================

/**
 * Look up scheduled trip using deterministic key and enrich schedule-derived fields.
 *
 * Performs lookup when called by buildTrip (which handles event detection).
 * This no longer persists a ScheduledTrips document ID; instead it copies over
 * the small amount of schedule data that VesselTrips need immediately.
 *
 * @param ctx - Convex action context for database queries
 * @param baseTrip - Trip from baseTripFromLocation (has Key when derivable)
 * @param existingTrip - Previous trip (for field reuse), undefined for first trip
 * @returns Trip enriched with schedule-derived fields if lookup succeeds
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

  // Reuse already-enriched schedule fields if the business key is unchanged.
  if (existingTrip?.Key === tripKey) {
    return {
      ...baseTrip,
      NextScheduledDeparture:
        baseTrip.NextScheduledDeparture ?? existingTrip.NextScheduledDeparture,
    };
  }

  const scheduledTrip = await ctx.runQuery(
    internal.functions.scheduledTrips.queries.getScheduledTripByKey,
    { key: tripKey }
  );

  return {
    ...baseTrip,
    NextScheduledDeparture:
      baseTrip.NextScheduledDeparture ?? scheduledTrip?.NextDepartingTime,
  };
};
