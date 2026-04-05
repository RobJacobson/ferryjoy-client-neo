/**
 * Scheduled-boundary lookup - enriches trips from normalized `eventsScheduled`.
 *
 * Takes a base trip and resolves schedule-derived context from the backend's
 * canonical boundary-event table rather than from `scheduledTrips`.
 */
import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { resolveDockedScheduledSegment } from "functions/eventsScheduled/dockedScheduleResolver";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Look up normalized scheduled boundary context and enrich schedule-derived fields.
 *
 * Performs lookup when called by buildTrip (which handles event detection).
 * This copies the small amount of schedule context `vesselTrips` need
 * immediately without depending on `scheduledTrips`.
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
  // Keyless docked trips are the one place where `vesselTrips` still has to
  // ask "which scheduled segment owns this vessel right now?" instead of
  // simply reusing the trip key already carried by live state.
  const inferredScheduledSegment =
    baseTrip.AtDock && !baseTrip.LeftDock && !baseTrip.Key
      ? await inferDockedTripFromSchedule(ctx, baseTrip, existingTrip)
      : null;

  if (inferredScheduledSegment) {
    return {
      ...baseTrip,
      ArrivingTerminalAbbrev:
        baseTrip.ArrivingTerminalAbbrev ??
        inferredScheduledSegment.ArrivingTerminalAbbrev,
      Key: inferredScheduledSegment.Key,
      SailingDay: inferredScheduledSegment.SailingDay,
      ScheduledDeparture:
        baseTrip.ScheduledDeparture ?? inferredScheduledSegment.DepartingTime,
      NextKey: inferredScheduledSegment.NextKey ?? baseTrip.NextKey,
      NextScheduledDeparture:
        inferredScheduledSegment.NextDepartingTime ??
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
  const scheduledSegment = await ctx.runQuery(
    internal.functions.eventsScheduled.queries
      .getScheduledDepartureSegmentBySegmentKey,
    { segmentKey: tripKey }
  );

  // Prefer fresh lookup (new normalized events); fall back to carried values.
  return {
    ...baseTrip,
    NextKey: scheduledSegment?.NextKey ?? baseTrip.NextKey,
    NextScheduledDeparture:
      scheduledSegment?.NextDepartingTime ?? baseTrip.NextScheduledDeparture,
  };
};

/**
 * Infer scheduled identity for a docked trip that does not yet have a key.
 *
 * Rollover cases prefer continuity from the previous trip's next segment so
 * late arrivals stay attached to the delayed real next sailing instead of
 * skipping ahead to a later scheduled departure.
 *
 * @param ctx - Convex action context for scheduled-boundary lookups
 * @param baseTrip - Docked trip still missing schedule identity
 * @param existingTrip - Previous trip context when available
 * @returns Matching scheduled segment, or `null` when no candidate is found
 */
const inferDockedTripFromSchedule = async (
  ctx: ActionCtx,
  baseTrip: ConvexVesselTrip,
  existingTrip: ConvexVesselTrip | undefined
) => {
  const resolution = await resolveDockedScheduledSegment(
    {
      getScheduledDepartureSegmentBySegmentKey: (segmentKey) =>
        ctx.runQuery(
          internal.functions.eventsScheduled.queries
            .getScheduledDepartureSegmentBySegmentKey,
          { segmentKey }
        ),
      getNextDepartureSegmentAfterDeparture: (args) =>
        ctx.runQuery(
          internal.functions.eventsScheduled.queries
            .getNextDepartureSegmentAfterDeparture,
          args
        ),
      getDockedDepartureSegmentForVesselAtTerminal: (args) =>
        ctx.runQuery(
          internal.functions.eventsScheduled.queries
            .getDockedDepartureSegmentForVesselAtTerminal,
          args
        ),
    },
    {
      vesselAbbrev: baseTrip.VesselAbbrev,
      departingTerminalAbbrev: baseTrip.DepartingTerminalAbbrev,
      observedAt: baseTrip.TimeStamp,
      existingTrip,
    }
  );

  return resolution?.segment ?? null;
};
