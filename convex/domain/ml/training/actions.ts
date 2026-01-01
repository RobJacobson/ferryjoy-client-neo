"use node";

import { internalAction } from "_generated/server";
import type { TrainingResponse } from "domain/ml/shared/types";
import { runMLPipeline } from "./pipeline";

// ============================================================================
// PUBLIC ACTIONS
// ============================================================================

/**
 * Trains prediction models for all terminal pairs using the complete ML pipeline
 *
 * This action orchestrates the entire machine learning pipeline:
 * 1. Loads WSF vessel history data
 * 2. Converts raw data to training records with feature engineering
 * 3. Groups records by terminal pairs and applies sampling
 * 4. Trains linear regression models for each terminal pair and model type
 * 5. Stores trained models in the database
 *
 * @param ctx - Convex internal action context
 * @returns Training response with statistics and data quality metrics
 */
export const trainPredictionModelsAction = internalAction({
  args: {},
  handler: async (ctx): Promise<TrainingResponse> => {
    console.log("Starting ML training pipeline with WSF data source");
    return await runMLPipeline(ctx);
  },
});
