// ============================================================================
// ML TRAINING ACTIONS
// Convex actions for triggering ML model training pipelines
// ============================================================================

"use node";

import { internalAction } from "_generated/server";
import type { TrainingResponse } from "../shared/types";
import { runMLPipeline } from "./pipeline";

/**
 * Execute the complete ML training pipeline.
 *
 * Triggers end-to-end model training including data loading, feature extraction,
 * model training, and deployment. This is a long-running operation that may
 * take several minutes to complete.
 *
 * @returns Training results with statistics and successfully trained models
 */
export const trainPredictionModelsAction = internalAction({
  args: {},
  handler: async (ctx): Promise<TrainingResponse> => runMLPipeline(ctx),
});
