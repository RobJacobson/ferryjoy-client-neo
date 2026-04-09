/**
 * Loads same-day normalized rows for the VesselTimeline backbone query.
 */

import type { QueryCtx } from "_generated/server";
import { stripConvexMeta } from "../../../shared/stripConvexMeta";
import type { ConvexActualBoundaryEvent } from "../../eventsActual/schemas";
import type { ConvexPredictedBoundaryEvent } from "../../eventsPredicted/schemas";
import type { ConvexScheduledBoundaryEvent } from "../../eventsScheduled/schemas";

export type LoadedVesselTimelineBackboneInputs = {
  scheduledEvents: ConvexScheduledBoundaryEvent[];
  actualEvents: ConvexActualBoundaryEvent[];
  predictedEvents: ConvexPredictedBoundaryEvent[];
};

/**
 * Loads all inputs needed to build the backend-owned VesselTimeline backbone.
 *
 * @param ctx - Convex query context
 * @param args - Vessel/day scope
 * @returns Loaded inputs ready for domain assembly
 */
export const loadVesselTimelineBackboneInputs = async (
  ctx: QueryCtx,
  args: {
    VesselAbbrev: string;
    SailingDay: string;
  }
): Promise<LoadedVesselTimelineBackboneInputs> => {
  const [scheduledDocs, actualDocs, predictedDocs] = await Promise.all([
    ctx.db
      .query("eventsScheduled")
      .withIndex("by_vessel_and_sailing_day", (q) =>
        q
          .eq("VesselAbbrev", args.VesselAbbrev)
          .eq("SailingDay", args.SailingDay)
      )
      .collect(),
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
  ]);

  return {
    scheduledEvents: scheduledDocs.map(stripConvexMeta),
    actualEvents: actualDocs.map(stripConvexMeta),
    predictedEvents: predictedDocs.map(stripConvexMeta),
  };
};
