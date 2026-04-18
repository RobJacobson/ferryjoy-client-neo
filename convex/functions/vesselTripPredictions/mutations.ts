/**
 * Internal mutations for `vesselTripPredictions` (compare-then-write upserts).
 */

import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import { planVesselTripPredictionWrite } from "domain/vesselOrchestration/updateVesselPredictions";
import { vesselTripPredictionProposalSchema } from "./schemas";

/**
 * Applies a batch of ML prediction proposals: loads each natural key, skips when
 * overlay-normalized values are unchanged, otherwise inserts or replaces.
 *
 * @param ctx - Convex internal mutation context
 * @param args.proposals - Proposed snapshots keyed by vessel, trip, field
 * @returns Counts of skipped, inserted, and replaced rows
 */
export const batchUpsertProposals = internalMutation({
  args: {
    proposals: v.array(vesselTripPredictionProposalSchema),
  },
  returns: v.object({
    skipped: v.number(),
    inserted: v.number(),
    replaced: v.number(),
  }),
  handler: async (ctx, args) => {
    const updatedAt = Date.now();
    let skipped = 0;
    let inserted = 0;
    let replaced = 0;

    for (const proposal of args.proposals) {
      const existing = await ctx.db
        .query("vesselTripPredictions")
        .withIndex("by_vessel_trip_and_field", (q) =>
          q
            .eq("VesselAbbrev", proposal.VesselAbbrev)
            .eq("TripKey", proposal.TripKey)
            .eq("PredictionType", proposal.PredictionType)
        )
        .unique();

      const plan = planVesselTripPredictionWrite(existing, proposal, updatedAt);

      if (plan.type === "skip") {
        skipped++;
        continue;
      }

      if (plan.type === "insert") {
        await ctx.db.insert("vesselTripPredictions", plan.row);
        inserted++;
        continue;
      }

      await ctx.db.replace(plan.existingId, plan.row);
      replaced++;
    }

    return { skipped, inserted, replaced };
  },
});
