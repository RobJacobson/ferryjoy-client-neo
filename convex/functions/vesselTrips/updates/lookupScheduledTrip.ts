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
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";
import { stripConvexMeta } from "shared/stripConvexMeta";

// ============================================================================
// lookupScheduleAtArrival
// ============================================================================

/**
 * Look up arriving terminal when vessel just arrived at dock.
 *
 * Returns augmented trip with arrival terminal and scheduled trip data when:
 * 1. Vessel just arrived at dock (AtDock: false → true)
 * 2. Missing ArrivingTerminalAbbrev in both current and existing trip
 * 3. Has required fields: VesselAbbrev, DepartingTerminalAbbrev, ScheduledDeparture
 *
 * Otherwise returns baseTrip unchanged (no DB hit).
 *
 * @param ctx - Convex action context for database queries
 * @param baseTrip - Current trip state (from buildTripFromRawData)
 * @param existingTrip - Previous trip (for event detection)
 * @returns Augmented trip
 */
export const lookupScheduleAtArrival = async (
  ctx: ActionCtx,
  baseTrip: ConvexVesselTrip,
  existingTrip?: ConvexVesselTrip
): Promise<ConvexVesselTrip> => {
  // Event: Just arrived at dock (AtDock: false → true)
  const didJustArriveAtDock =
    existingTrip && !existingTrip.AtDock && baseTrip.AtDock;

  // Bail out if not the right event
  if (!didJustArriveAtDock) {
    return baseTrip;
  }

  // Already have arriving terminal - no lookup needed
  if (baseTrip.ArrivingTerminalAbbrev) {
    return baseTrip;
  }

  // Missing required fields - can't lookup
  if (
    !baseTrip.VesselAbbrev ||
    !baseTrip.DepartingTerminalAbbrev ||
    !baseTrip.ScheduledDeparture
  ) {
    return baseTrip;
  }

  // Perform heuristic lookup
  try {
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
      const trip = stripConvexMeta(
        scheduledTrip as Record<string, unknown>
      ) as ConvexScheduledTrip;
      return {
        ...baseTrip,
        ArrivingTerminalAbbrev: trip.ArrivingTerminalAbbrev,
        RouteID: trip.RouteID,
        RouteAbbrev: trip.RouteAbbrev,
        ScheduledTrip: trip,
      };
    }
  } catch (error) {
    console.error(
      `[ScheduleArrivalLookup] Failed for vessel ${baseTrip.VesselAbbrev}:`,
      error
    );
  }

  return baseTrip;
};

// ============================================================================
// buildTripWithSchedule
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
 * Look up scheduled trip using deterministic key and merge schedule data.
 *
 * Performs lookup when:
 * 1. Both ArrivingTerminalAbbrev and ScheduledDeparture just became available (first time with derivable Key)
 * 2. OR Key changed from existing trip
 *
 * Returns trip with RouteID, RouteAbbrev, ScheduledTrip merged.
 * When key invalid or repositioning, clears predictions.
 *
 * @param ctx - Convex action context for database queries
 * @param baseTrip - Trip from buildTripFromRawData (has Key when derivable)
 * @param existingTrip - Previous trip (for key-changed detection and reuse)
 * @returns Trip with RouteID, RouteAbbrev, ScheduledTrip merged
 */
export const buildTripWithSchedule = async (
  ctx: ActionCtx,
  baseTrip: ConvexVesselTrip,
  existingTrip?: ConvexVesselTrip
): Promise<ConvexVesselTrip> => {
  const tripKey = baseTrip.Key ?? null;

  if (!tripKey) {
    return { ...baseTrip, ...CLEARED_PREDICTIONS };
  }

  // Event: Arrival data just became available (first time with derivable Key)
  const didArrivalDataBecomeAvailable =
    existingTrip &&
    !existingTrip.ArrivingTerminalAbbrev &&
    baseTrip.ArrivingTerminalAbbrev &&
    !existingTrip.ScheduledDeparture &&
    baseTrip.ScheduledDeparture;

  // Event: Key changed from existing trip
  const keyChanged =
    existingTrip?.Key !== undefined && tripKey !== existingTrip.Key;

  // Bail out: none of the trigger events met
  if (!didArrivalDataBecomeAvailable && !keyChanged) {
    // Reuse existing schedule data
    if (existingTrip?.ScheduledTrip && existingTrip?.RouteID) {
      return {
        ...baseTrip,
        RouteID: existingTrip.RouteID,
        RouteAbbrev: existingTrip.RouteAbbrev,
        ScheduledTrip: existingTrip.ScheduledTrip,
      };
    }
    // No existing schedule data - return baseTrip as-is
    return baseTrip;
  }

  // Perform lookup (triggered by Event 2 or 3)
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
