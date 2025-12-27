// ============================================================================
// STEP 6: STORE RESULTS
// Simple database storage with fail-fast on errors
// ============================================================================

import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { ModelParameters } from "../types";
import { formatTerminalPairKey } from "./shared/config";

/**
 * Store model results
 * Fails immediately if any model storage fails (storage is critical)
 */
export const storeModelResults = async (
  results: ModelParameters[],
  ctx: ActionCtx
): Promise<void> => {
  console.log(`Storing ${results.length} model results`);

  let storedCount = 0;

  // Process sequentially for immediate error detection
  for (const model of results) {
    const pairKey = formatTerminalPairKey(
      model.departingTerminalAbbrev,
      model.arrivingTerminalAbbrev
    );

    try {
      await ctx.runMutation(
        api.functions.predictions.mutations.storeModelParametersMutation,
        {
          model: {
            departingTerminalAbbrev: model.departingTerminalAbbrev,
            arrivingTerminalAbbrev: model.arrivingTerminalAbbrev,
            modelType: model.modelType,

            // Optional model parameters
            coefficients: model.coefficients,
            intercept: model.intercept,
            trainingMetrics: model.trainingMetrics,

            // Required metadata
            createdAt: model.createdAt,

            // Bucket statistics
            bucketStats: {
              totalRecords: model.bucketStats.totalRecords,
              filteredRecords: model.bucketStats.filteredRecords,
              meanDepartureDelay: model.bucketStats.meanDepartureDelay,
              meanAtSeaDuration: model.bucketStats.meanAtSeaDuration,
              meanDelay: model.bucketStats.meanDelay,
            },
          },
        }
      );

      storedCount++;
      console.log(`Stored ${model.modelType} model for ${pairKey}`);
    } catch (error) {
      console.error(
        `Failed to store ${model.modelType} model for ${pairKey}:`,
        error
      );
      // Re-throw to fail fast - storage failure is critical
      throw new Error(
        `Failed to store model for ${pairKey} after ${storedCount} successful saves: ${error}`
      );
    }
  }

  console.log(`Successfully stored ${storedCount}/${results.length} models`);
};
