/**
 * Persists prediction proposals for one vessel branch when rows exist.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { VesselTripPredictionProposal } from "functions/vesselTripPredictions/schemas";

/**
 * Writes prediction proposal rows for the current branch if rows exist.
 *
 * @param ctx - Convex mutation context for prediction persistence
 * @param predictionRows - Sparse prediction rows produced by prediction stage
 * @returns Resolves when prediction rows are upserted
 */
export const persistPredictionRows = async (
  ctx: ActionCtx,
  predictionRows: ReadonlyArray<VesselTripPredictionProposal>
): Promise<void> => {
  if (predictionRows.length > 0) {
    await ctx.runMutation(
      internal.functions.vesselTripPredictions.mutations.batchUpsertProposals,
      { proposals: Array.from(predictionRows) }
    );
  }
};
