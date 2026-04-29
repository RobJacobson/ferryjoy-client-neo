/**
 * Persists prediction proposals for one vessel branch when rows exist.
 */

import type { MutationCtx } from "_generated/server";
import { batchUpsertProposalsInDb } from "functions/vesselTripPredictions/mutations";
import type { VesselTripPredictionProposal } from "functions/vesselTripPredictions/schemas";

/**
 * Writes prediction rows for the current branch if the proposal set is non-empty.
 *
 * @param ctx - Convex mutation context for prediction persistence
 * @param predictionRows - Sparse prediction rows produced by prediction stage
 * @returns Resolves when prediction rows are upserted
 */
export const persistVesselPredictions = async (
  ctx: MutationCtx,
  predictionRows: ReadonlyArray<VesselTripPredictionProposal>
): Promise<void> => {
  if (predictionRows.length > 0) {
    await batchUpsertProposalsInDb(ctx, predictionRows);
  }
};
