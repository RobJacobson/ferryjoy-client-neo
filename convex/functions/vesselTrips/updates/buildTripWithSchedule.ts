/**
 * Scheduled trip lookup - returns trip with scheduledTripId reference.
 *
 * Takes base trip (Key from buildTripFromRawData), performs I/O-conditioned
 * lookup by Key. Sets scheduledTripId reference when found.
 * Clears stale predictions when Key is undefined (repositioning) or key changed.
 */
import { api, internal } from "_generated/api";
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
 * and scheduledTripId if found.
 *
 * @param ctx - Convex action context for database queries
 * @param baseTrip - Current trip state (from buildTripFromRawData)
 * @returns Trip with arrival terminal and scheduled trip ID if lookup succeeds
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
    console.log("Missing required fields for initial schedule", baseTrip);
    return baseTrip;
  }

  const lookupArgs = {
    vesselAbbrev: baseTrip.VesselAbbrev,
    departingTerminalAbbrev: baseTrip.DepartingTerminalAbbrev,
    // biome-ignore lint/style/noNonNullAssertion: hasRequiredFields ensures ScheduledDeparture is defined
    scheduledDeparture: baseTrip.ScheduledDeparture!,
  };

  const scheduledTrip = await ctx.runQuery(
    api.functions.scheduledTrips.queries.findScheduledTripForArrivalLookup,
    lookupArgs
  );

  const result = {
    ...baseTrip,
    ArrivingTerminalAbbrev: scheduledTrip?.ArrivingTerminalAbbrev,
    scheduledTripId: scheduledTrip?._id,
  };
  console.log("Initial schedule", lookupArgs, result);
  return result;
};

// ============================================================================
// buildTripWithFinalSchedule
// ============================================================================

/**
 * Look up scheduled trip using deterministic key and set scheduledTripId reference.
 *
 * Performs lookup when called by buildTripWithAllData (which handles
 * event detection). Reuses existing scheduledTripId when appropriate.
 * Clears predictions when key invalid or missing.
 *
 * @param ctx - Convex action context for database queries
 * @param baseTrip - Trip from buildTripFromRawData (has Key when derivable)
 * @param existingTrip - Previous trip (for reuse)
 * @returns Trip with scheduledTripId set if lookup succeeds
 */
export const buildTripWithFinalSchedule = async (
  ctx: ActionCtx,
  baseTrip: ConvexVesselTrip,
  existingTrip: ConvexVesselTrip
): Promise<ConvexVesselTrip> => {
  const tripKey = baseTrip.Key ?? null;

  if (!tripKey) {
    console.log("Missing trip key for final schedule", baseTrip);
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
    scheduledTripId: scheduledTripId ?? undefined,
  };
  console.log("Final schedule", tripKey, result);
  return result;
};
