/**
 * Composes same-day backbone loads and the domain view model for the public query.
 */

import type { QueryCtx } from "_generated/server";
import { buildTimelineBackbone } from "../../../domain/timelineBackbone";
import { loadVesselTimelineBackboneInputs } from "./loadBackboneInputs";

/**
 * Loads normalized boundary rows and builds the VesselTimeline backbone payload.
 *
 * @param ctx - Convex query context
 * @param args - Vessel and sailing day scope
 * @returns Backbone result for the `getVesselTimelineBackbone` Convex query
 */
export const getVesselTimelineBackbone = async (
  ctx: QueryCtx,
  args: { VesselAbbrev: string; SailingDay: string }
) => {
  const inputs = await loadVesselTimelineBackboneInputs(ctx, args);

  return buildTimelineBackbone({
    VesselAbbrev: args.VesselAbbrev,
    SailingDay: args.SailingDay,
    ...inputs,
  });
};
