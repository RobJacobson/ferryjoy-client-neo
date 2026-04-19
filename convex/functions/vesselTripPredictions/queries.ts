/**
 * Internal queries for `vesselTripPredictions` batch reads.
 */

import type { Doc } from "_generated/dataModel";
import { internalQuery } from "_generated/server";
import { v } from "convex/values";
import { vesselTripPredictionDocSchema } from "./schemas";

/**
 * Loads all prediction rows for the given vessel + physical trip pairs (up to
 * five per trip, one per `PredictionType`).
 *
 * @param ctx - Convex internal query context
 * @param args.scopes - Distinct `(VesselAbbrev, TripKey)` pairs to load
 * @returns All matching documents
 */
export const listByVesselTripScopes = internalQuery({
  args: {
    scopes: v.array(
      v.object({
        VesselAbbrev: v.string(),
        TripKey: v.string(),
      })
    ),
  },
  returns: v.array(vesselTripPredictionDocSchema),
  handler: async (ctx, args) => {
    const out: Doc<"vesselTripPredictions">[] = [];

    for (const scope of args.scopes) {
      const rows = await ctx.db
        .query("vesselTripPredictions")
        .withIndex("by_vessel_and_trip", (q) =>
          q.eq("VesselAbbrev", scope.VesselAbbrev).eq("TripKey", scope.TripKey)
        )
        .collect();
      out.push(...rows);
    }

    return out;
  },
});
