import type { ActionCtx } from "@convex/_generated/server";

import { log } from "@/shared/lib/logger";

import { encodeFeatures } from "./pipeline/encode";
import { loadAndFilterTrips } from "./pipeline/load";
import { trainAndSave } from "./pipeline/train";
import type { TrainingResponse } from "./types";

/**
 * Main training pipeline: Load → Encode → Train → Save
 * Simple linear flow for weekly model training
 */
export const trainModels = async (
  ctx: ActionCtx
): Promise<TrainingResponse> => {
  log.info("Starting ML model training pipeline");

  try {
    // Stage 1: Load and filter trips
    const pairs = await loadAndFilterTrips(ctx);

    // Stage 2: Encode features
    const examples = encodeFeatures(pairs);

    // Stage 3: Train and save models
    const result = await trainAndSave(ctx, examples, pairs);

    log.info("Training pipeline completed successfully");
    return result;
  } catch (error) {
    log.error("Training pipeline failed:", error);
    throw error;
  }
};
