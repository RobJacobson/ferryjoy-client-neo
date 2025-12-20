// ============================================================================
// STEP 6: STORE RESULTS
// Database storage with error handling and retries
// ============================================================================

import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { PIPELINE_CONFIG } from "domain/ml/pipeline/shared/config";
import type { PipelineLogger } from "domain/ml/pipeline/shared/logging";
import type { ModelParameters } from "domain/ml/types";
import { PipelineError, PipelineErrorType } from "domain/ml/types";

/**
 * Store model results with error handling and retries
 */
export const storeModelResults = async (
  results: ModelParameters[],
  ctx: ActionCtx,
  logger: PipelineLogger
): Promise<void> => {
  logger.logStepStart("storeResults", { resultCount: results.length });

  const savePromises = results.map((model, index) =>
    storeSingleModelWithRetry(model, ctx, logger, index)
  );

  const outcomes = await Promise.allSettled(savePromises);
  const successful = outcomes.filter((o) => o.status === "fulfilled").length;
  const failed = outcomes.filter((o) => o.status === "rejected").length;

  logger.logStepEnd("storeResults", 0, {
    attempted: results.length,
    successful,
    failed,
    successRate: `${((successful / results.length) * 100).toFixed(1)}%`,
  });

  if (failed > 0) {
    logger.warn(`Failed to store ${failed} models`, {
      failedCount: failed,
      totalCount: results.length,
    });
  }
};

/**
 * Store a single model with retry logic
 */
const storeSingleModelWithRetry = async (
  model: ModelParameters,
  ctx: ActionCtx,
  logger: PipelineLogger,
  index: number
): Promise<void> => {
  const pairKey = `${model.departingTerminalAbbrev}_${model.arrivingTerminalAbbrev}`;

  for (
    let attempt = 1;
    attempt <= PIPELINE_CONFIG.MAX_RETRY_ATTEMPTS;
    attempt++
  ) {
    try {
      await ctx.runMutation(
        api.functions.predictions.mutations.storeModelParametersMutation,
        {
          model: {
            departingTerminalAbbrev: model.departingTerminalAbbrev,
            arrivingTerminalAbbrev: model.arrivingTerminalAbbrev,
            modelType: model.modelType,
            modelAlgorithm: PIPELINE_CONFIG.MODEL_ALGORITHM,

            // Optional model parameters
            coefficients: model.coefficients,
            intercept: model.intercept,
            featureNames: model.featureNames,
            trainingMetrics: model.trainingMetrics,

            // Required metadata
            createdAt: model.createdAt,

            // Bucket statistics (always present)
            bucketStats: {
              totalRecords: model.bucketStats.totalRecords,
              filteredRecords: model.bucketStats.filteredRecords,
              meanDepartureDelay:
                model.bucketStats.meanDepartureDelay ?? undefined,
              meanAtSeaDuration:
                model.bucketStats.meanAtSeaDuration ?? undefined,
            },
          },
        }
      );

      if (attempt > 1) {
        logger.info(
          `Successfully stored ${model.modelType} model for ${pairKey} on attempt ${attempt}`
        );
      }
      return;
    } catch (error) {
      const isLastAttempt = attempt === PIPELINE_CONFIG.MAX_RETRY_ATTEMPTS;

      if (isLastAttempt) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error(
          `Failed to store ${model.modelType} model for ${pairKey} after ${attempt} attempts`,
          {
            error: errorMessage,
            index,
            pairKey,
          }
        );
        throw new PipelineError(
          `Storage failed after retries: ${errorMessage}`,
          PipelineErrorType.STORAGE,
          "storeResults",
          {
            departingTerminalAbbrev: model.departingTerminalAbbrev,
            arrivingTerminalAbbrev: model.arrivingTerminalAbbrev,
          },
          false, // Not recoverable after max retries
          { attempt, index }
        );
      } else {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.warn(
          `Storage attempt ${attempt} failed for ${pairKey}, retrying...`,
          {
            error: errorMessage,
            attempt,
            maxAttempts: PIPELINE_CONFIG.MAX_RETRY_ATTEMPTS,
          }
        );

        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            PIPELINE_CONFIG.RETRY_BACKOFF_MS * 2 ** (attempt - 1)
          )
        );
      }
    }
  }
};
