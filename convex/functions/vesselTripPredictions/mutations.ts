/**
 * Internal mutations for `vesselTripPredictions` (compare-then upserts).
 */

import type { MutationCtx } from "_generated/server";
import { internalMutation } from "_generated/server";
import { v } from "convex/values";
import type { VesselTripPredictionProposal } from "./schemas";
import { vesselTripPredictionProposalSchema } from "./schemas";
import { decideVesselTripPredictionUpsert } from "./vesselTripPredictionPersistPlan";

/**
 * Applies a batch of ML prediction proposals with compare-then-write semantics.
 *
 * Convex entrypoint around `upsertPredictionProposals` for orchestrator and
 * tooling; returns aggregate skip/insert/replace counts.
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
  handler: async (ctx, args) => upsertPredictionProposals(ctx, args.proposals),
});

/**
 * Applies each proposal sequentially against `vesselTripPredictions`.
 *
 * Uses `by_vessel_trip_and_field` plus `decideVesselTripPredictionUpsert` so
 * overlay-equal payloads skip writes and share one `UpdatedAt` clock per batch.
 *
 * @param ctx - Convex mutation context
 * @param proposals - ML snapshots from the orchestrator or batch tooling
 * @returns Counts of skipped, inserted, and replaced rows
 */
export const upsertPredictionProposals = async (
  ctx: MutationCtx,
  proposals: ReadonlyArray<VesselTripPredictionProposal>
): Promise<{
  skipped: number;
  inserted: number;
  replaced: number;
}> => {
  const updatedAt = Date.now();
  let skipped = 0;
  let inserted = 0;
  let replaced = 0;

  for (const proposal of proposals) {
    const existing = await ctx.db
      .query("vesselTripPredictions")
      .withIndex("by_vessel_trip_and_field", (q) =>
        q
          .eq("VesselAbbrev", proposal.VesselAbbrev)
          .eq("TripKey", proposal.TripKey)
          .eq("PredictionType", proposal.PredictionType)
      )
      .unique();

    const decision = decideVesselTripPredictionUpsert(
      existing,
      proposal,
      updatedAt
    );

    if (decision.type === "skip") {
      skipped++;
      continue;
    }

    if (decision.type === "insert") {
      await ctx.db.insert("vesselTripPredictions", decision.row);
      inserted++;
      continue;
    }

    await ctx.db.replace(decision.existingId, decision.row);
    replaced++;
  }

  return { skipped, inserted, replaced };
};
