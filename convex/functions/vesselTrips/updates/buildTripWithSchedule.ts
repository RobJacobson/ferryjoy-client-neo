/**
 * Scheduled trip lookup - returns trip with ScheduledTrip merged.
 *
 * Takes base trip (Key from buildTripFromRawData), performs I/O-conditioned
 * lookup by Key. RouteID/RouteAbbrev live on ScheduledTrip. Clears stale
 * predictions when Key is undefined (repositioning) or key changed.
 */
import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

// ============================================================================
// buildTripWithInitialSchedule
// ============================================================================

/**
 * Look up arriving terminal when vessel just arrived at dock.
 *
 * Performs heuristic lookup using VesselAbbrev, DepartingTerminalAbbrev,
 * and ScheduledDeparture. Returns trip with ArrivingTerminalAbbrev
 * and ScheduledTrip if found.
 *
 * @param ctx - Convex action context for database queries
 * @param baseTrip - Current trip state (from buildTripFromRawData)
 * @returns Trip with arrival terminal and scheduled trip if lookup succeeds
 */
export const buildTripWithInitialSchedule = async (
  ctx: ActionCtx,
  baseTrip: ConvexVesselTrip
): Promise<ConvexVesselTrip> => {
  // Missing required fields - can't lookup
  if (
    !baseTrip.VesselAbbrev ||
    !baseTrip.DepartingTerminalAbbrev ||
    !baseTrip.ScheduledDeparture
  ) {
    return baseTrip;
  }

  // Perform heuristic lookup
  const scheduledTrip = await ctx.runQuery(
    api.functions.scheduledTrips.queries.findScheduledTripForArrivalLookup,
    {
      vesselAbbrev: baseTrip.VesselAbbrev,
      departingTerminalAbbrev: baseTrip.DepartingTerminalAbbrev,
      // biome-ignore lint/style/noNonNullAssertion: hasRequiredFields ensures ScheduledDeparture is defined
      scheduledDeparture: baseTrip.ScheduledDeparture!,
    }
  );

  if (scheduledTrip) {
    return {
      ...baseTrip,
      ArrivingTerminalAbbrev: scheduledTrip.ArrivingTerminalAbbrev,
      ScheduledTrip: scheduledTrip,
    };
  }

  return baseTrip;
};

// ============================================================================
// buildTripWithFinalSchedule
// ============================================================================

/**
 * Look up scheduled trip using deterministic key and merge schedule data.
 *
 * Performs lookup when called by buildTripWithAllData (which handles
 * event detection). Reuses existing ScheduledTrip when appropriate.
 * Clears predictions when key invalid or missing.
 *
 * @param ctx - Convex action context for database queries
 * @param baseTrip - Trip from buildTripFromRawData (has Key when derivable)
 * @param existingTrip - Previous trip (for reuse)
 * @returns Trip with ScheduledTrip merged
 */
export const buildTripWithFinalSchedule = async (
  ctx: ActionCtx,
  baseTrip: ConvexVesselTrip,
  existingTrip?: ConvexVesselTrip
): Promise<ConvexVesselTrip> => {
  const tripKey = baseTrip.Key ?? null;

  if (!tripKey) {
    return baseTrip;
  }

  // Reuse existing ScheduledTrip if key hasn't changed
  if (existingTrip?.ScheduledTrip && existingTrip.Key === tripKey) {
    return { ...baseTrip, ScheduledTrip: existingTrip.ScheduledTrip };
  }

  // Perform lookup
  const scheduledTrip = await ctx.runQuery(
    api.functions.scheduledTrips.queries.getScheduledTripByKey,
    { key: tripKey }
  );

  if (!scheduledTrip) {
    return baseTrip;
  }

  return {
    ...baseTrip,
    ScheduledTrip: scheduledTrip,
  };
};
