/**
 * Convex-specific VesselTimeline loaders and event-backed identity helpers.
 *
 * This module owns database access and query-time orchestration for the public
 * VesselTimeline query. The read path is intentionally scoped to one sailing
 * day plus the current `vesselLocations` row; pure row-building and attachment
 * logic stay in the domain layer.
 */

import type { QueryCtx } from "_generated/server";
import { resolveInferredDockedTripKey } from "../../domain/vesselTimeline/ownership";
import { stripConvexMeta } from "../../shared/stripConvexMeta";
import type { ConvexActualBoundaryEvent } from "../eventsActual/schemas";
import type { ConvexPredictedBoundaryEvent } from "../eventsPredicted/schemas";
import type { ConvexScheduledBoundaryEvent } from "../eventsScheduled/schemas";
import type { ConvexVesselLocation } from "../vesselLocation/schemas";

export type LoadedVesselTimelineViewModelInputs = {
  scheduledEvents: ConvexScheduledBoundaryEvent[];
  actualEvents: ConvexActualBoundaryEvent[];
  predictedEvents: ConvexPredictedBoundaryEvent[];
  location: ConvexVesselLocation | null;
  inferredDockedTripKey: string | null;
};

/**
 * Loads all inputs needed to build the backend-owned VesselTimeline view
 * model.
 *
 * @param ctx - Convex query context
 * @param args - Vessel/day scope
 * @returns Loaded inputs ready for domain assembly
 */
export const loadVesselTimelineViewModelInputs = async (
  ctx: QueryCtx,
  args: {
    VesselAbbrev: string;
    SailingDay: string;
  }
): Promise<LoadedVesselTimelineViewModelInputs> => {
  const [scheduledDocs, actualDocs, predictedDocs, locationDoc] =
    await Promise.all([
      loadScheduledBoundaryEventsForSailingDay(
        ctx,
        args.VesselAbbrev,
        args.SailingDay
      ),
      ctx.db
        .query("eventsActual")
        .withIndex("by_vessel_and_sailing_day", (q) =>
          q
            .eq("VesselAbbrev", args.VesselAbbrev)
            .eq("SailingDay", args.SailingDay)
        )
        .collect(),
      ctx.db
        .query("eventsPredicted")
        .withIndex("by_vessel_and_sailing_day", (q) =>
          q
            .eq("VesselAbbrev", args.VesselAbbrev)
            .eq("SailingDay", args.SailingDay)
        )
        .collect(),
      ctx.db
        .query("vesselLocations")
        .withIndex("by_vessel_abbrev", (q) =>
          q.eq("VesselAbbrev", args.VesselAbbrev)
        )
        .unique(),
    ]);

  const scheduledEvents = scheduledDocs.map(stripConvexMeta);
  const actualEvents = actualDocs.map(stripConvexMeta);
  const predictedEvents = predictedDocs.map(stripConvexMeta);
  const location = locationDoc ? stripConvexMeta(locationDoc) : null;
  const inferredDockedTripKey = resolveInferredDockedTripKey({
    scheduledEvents,
    location,
  });

  return {
    scheduledEvents,
    actualEvents,
    predictedEvents,
    location,
    inferredDockedTripKey,
  };
};

/**
 * Loads scheduled boundary events for one vessel and sailing day.
 *
 * @param ctx - Convex query context
 * @param vesselAbbrev - Vessel abbreviation
 * @param sailingDay - Sailing day in YYYY-MM-DD format
 * @returns Scheduled boundary-event documents for that vessel/day
 */
const loadScheduledBoundaryEventsForSailingDay = async (
  ctx: QueryCtx,
  vesselAbbrev: string,
  sailingDay: string
) => {
  return await ctx.db
    .query("eventsScheduled")
    .withIndex("by_vessel_and_sailing_day", (q) =>
      q.eq("VesselAbbrev", vesselAbbrev).eq("SailingDay", sailingDay)
    )
    .collect();
};
