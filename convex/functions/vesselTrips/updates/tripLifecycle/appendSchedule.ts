/**
 * Scheduled-boundary lookup - enriches trips from normalized `eventsScheduled`.
 *
 * Takes a base trip and resolves schedule-derived context from the backend's
 * canonical boundary-event table rather than from `scheduledTrips`.
 */
import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Look up normalized scheduled boundary context and enrich schedule-derived fields.
 *
 * Performs lookup when called by buildTrip (which handles event detection).
 * This copies the small amount of schedule context `vesselTrips` need
 * immediately without depending on `scheduledTrips`.
 *
 * @param ctx - Convex action context for database queries
 * @param baseTrip - Trip from baseTripFromLocation (has `ScheduleKey` when derivable)
 * @param existingTrip - Previous trip (for field reuse), undefined for first trip
 * @returns Trip enriched with schedule-derived fields if lookup succeeds
 */
export const appendFinalSchedule = async (
  ctx: ActionCtx,
  baseTrip: ConvexVesselTrip,
  existingTrip: ConvexVesselTrip | undefined
): Promise<ConvexVesselTrip> => {
  // If we have no schedule segment string, we cannot perform the lookup
  const segmentKey = baseTrip.ScheduleKey ?? null;
  if (!segmentKey) {
    return baseTrip;
  }

  // Reuse already-enriched schedule fields if the segment is unchanged.
  // baseTrip may carry NextScheduledDeparture; preserve it to avoid redundant lookup.
  if (existingTrip?.ScheduleKey === segmentKey) {
    return {
      ...baseTrip,
      ScheduleKey: baseTrip.ScheduleKey ?? existingTrip.ScheduleKey,
      NextScheduleKey: baseTrip.NextScheduleKey ?? existingTrip.NextScheduleKey,
      NextScheduledDeparture:
        baseTrip.NextScheduledDeparture ?? existingTrip.NextScheduledDeparture,
    };
  }

  // Perform the lookup
  const scheduledSegment = await ctx.runQuery(
    internal.functions.eventsScheduled.queries
      .getScheduledDepartureSegmentBySegmentKey,
    { segmentKey }
  );

  // Prefer fresh lookup (new normalized events); fall back to carried values.
  return {
    ...baseTrip,
    ScheduleKey: scheduledSegment?.Key ?? baseTrip.ScheduleKey,
    NextScheduleKey: scheduledSegment?.NextKey ?? baseTrip.NextScheduleKey,
    NextScheduledDeparture:
      scheduledSegment?.NextDepartingTime ?? baseTrip.NextScheduledDeparture,
  };
};
