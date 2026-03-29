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
