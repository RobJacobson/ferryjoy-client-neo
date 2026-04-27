/**
 * Prediction persistence helpers for per-vessel orchestrator writes.
 */

import type { MutationCtx } from "_generated/server";
import { batchUpsertProposalsInDb } from "functions/vesselTripPredictions/mutations";
import type { VesselTripPredictionProposal } from "functions/vesselTripPredictions/schemas";

/**
 * Persists prediction rows when non-empty.
 *
 * @param ctx - Convex mutation context
 * @param predictionRows - Sparse per-vessel prediction proposals
 */
export const persistVesselPredictions = async (
  ctx: MutationCtx,
  predictionRows: ReadonlyArray<VesselTripPredictionProposal>
): Promise<void> => {
  if (predictionRows.length > 0) {
    await batchUpsertProposalsInDb(ctx, predictionRows);
  }
};
