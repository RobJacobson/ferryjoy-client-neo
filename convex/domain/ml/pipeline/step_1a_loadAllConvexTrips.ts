// ============================================================================
// STEP 1A: LOAD ALL COMPLETED TRIPS FROM CONVEX
// Loads and filters trips from Convex database, returns TrainingDataRecord[]
// ============================================================================

import type { ActionCtx } from "_generated/server";
import type { TrainingDataRecord } from "domain/ml/types";
import type { PipelineLogger } from "./shared/logging";
import { loadAllCompletedTrips } from "./step_1_loadAllTrips";
import { filterAndConvertToTrainingRecords } from "./step_2_filterAndConvert";

/**
 * Load all completed trips from Convex database and convert to training records
 */
export const loadAllConvexTrips = async (
  ctx: ActionCtx,
  logger: PipelineLogger
): Promise<TrainingDataRecord[]> => {
  logger.logStepStart("loadAllConvexTrips");

  // Step 1: Load all completed trips from Convex
  const rawTrips = await loadAllCompletedTrips(ctx, logger);

  // Step 2: Filter and convert to training records
  const trainingRecords = filterAndConvertToTrainingRecords(rawTrips, logger);

  logger.logStepEnd("loadAllConvexTrips", 0, {
    totalTrips: rawTrips.length,
    trainingRecords: trainingRecords.length,
  });

  return trainingRecords;
};
