/**
 * Scheduled trip lookup - enriches trip with schedule data.
 *
 * Takes base trip (Key from baseTripFromLocation) and performs I/O-conditioned
 * lookup by Key. Schedule data is resolved lazily by Key rather than persisted
 * as a ScheduledTrips document ID.
 */
import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

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
  const inferredScheduledTrip =
    baseTrip.AtDock && !baseTrip.LeftDock && !baseTrip.Key
      ? await inferDockedTripFromSchedule(ctx, baseTrip, existingTrip)
      : null;

  if (inferredScheduledTrip) {
    return {
      ...baseTrip,
      ArrivingTerminalAbbrev:
        baseTrip.ArrivingTerminalAbbrev ??
        inferredScheduledTrip.ArrivingTerminalAbbrev,
      Key: inferredScheduledTrip.Key,
      SailingDay: inferredScheduledTrip.SailingDay,
      ScheduledDeparture:
        baseTrip.ScheduledDeparture ?? inferredScheduledTrip.DepartingTime,
      NextKey: inferredScheduledTrip.NextKey ?? baseTrip.NextKey,
      NextScheduledDeparture:
        inferredScheduledTrip.NextDepartingTime ??
        baseTrip.NextScheduledDeparture,
    };
  }

  // If the trip key is not present, we cannot perform the lookup
  const tripKey = baseTrip.Key ?? null;
  if (!tripKey) {
    return baseTrip;
  }

  // Reuse already-enriched schedule fields if the trip key is unchanged.
  // baseTrip may carry NextScheduledDeparture; preserve it to avoid redundant lookup.
  if (existingTrip?.Key === tripKey) {
    return {
      ...baseTrip,
      NextKey: baseTrip.NextKey ?? existingTrip.NextKey,
      NextScheduledDeparture:
        baseTrip.NextScheduledDeparture ?? existingTrip.NextScheduledDeparture,
    };
  }

  // Perform the lookup
  const scheduledTrip = await ctx.runQuery(
    internal.functions.scheduledTrips.queries.getScheduledTripByKey,
    { key: tripKey }
  );

  // Prefer fresh lookup (new schedule); fall back to carried when lookup fails
  return {
    ...baseTrip,
    NextKey: scheduledTrip?.NextKey ?? baseTrip.NextKey,
    NextScheduledDeparture:
      scheduledTrip?.NextDepartingTime ?? baseTrip.NextScheduledDeparture,
  };
};

/**
 * Infer schedule identity for a docked trip that does not yet have a key.
 *
 * Rollover cases prefer continuity from the previously scheduled trip so late
 * arrivals stay attached to the delayed "next" trip instead of skipping ahead
 * to a later trip whose scheduled departure is after the observed arrival.
 * First-seen docked vessels without prior trip context fall back to a
 * best-effort lookup from the current arrival time.
 *
 * @param ctx - Convex action context for scheduled-trip lookups
 * @param baseTrip - Docked trip still missing schedule identity
 * @param existingTrip - Previous trip context when available
 * @returns Matching scheduled trip, or `null` when no candidate is found
 */
const inferDockedTripFromSchedule = async (
  ctx: ActionCtx,
  baseTrip: ConvexVesselTrip,
  existingTrip: ConvexVesselTrip | undefined
) => {
  if (existingTrip?.NextKey) {
    // Best case: the completed trip already knows its exact scheduled successor.
    const exactNextTrip = await ctx.runQuery(
      internal.functions.scheduledTrips.queries.getScheduledTripByKey,
      { key: existingTrip.NextKey }
    );

    if (
      exactNextTrip &&
      exactNextTrip.DepartingTerminalAbbrev === baseTrip.DepartingTerminalAbbrev
    ) {
      return exactNextTrip;
    }
  }

  if (existingTrip?.ScheduledDeparture !== undefined) {
    // Late-service fallback: stay on the next trip after the completed trip's
    // scheduled departure, even if that departure time is already in the past.
    const rolloverMatch = await ctx.runQuery(
      internal.functions.scheduledTrips.queries
        .getNextScheduledTripForVesselAtTerminalAfterDeparture,
      {
        vesselAbbrev: baseTrip.VesselAbbrev,
        departingTerminalAbbrev: baseTrip.DepartingTerminalAbbrev,
        previousScheduledDeparture: existingTrip.ScheduledDeparture,
      }
    );

    if (rolloverMatch) {
      return rolloverMatch;
    }
  }

  // First-seen docked vessels have no prior schedule context, so fall back to
  // the first scheduled trip still ahead of the observed dock timestamp.
  return ctx.runQuery(
    internal.functions.scheduledTrips.queries.getNextScheduledTripForVesselAtTerminal,
    {
      vesselAbbrev: baseTrip.VesselAbbrev,
      departingTerminalAbbrev: baseTrip.DepartingTerminalAbbrev,
      arrivalTime: baseTrip.TimeStamp,
    }
  );
};
