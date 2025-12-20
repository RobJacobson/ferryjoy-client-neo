// ============================================================================
// STEP 1: LOAD ALL COMPLETED TRIPS
// Bulk loading with pagination and error handling
// ============================================================================

import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { PipelineLogger } from "domain/ml/pipeline/shared/logging";
import type {
  ConvexVesselTrip,
  VesselTrip,
} from "functions/vesselTrips/schemas";
import { toDomainVesselTrip } from "functions/vesselTrips/schemas";

/**
 * Load all completed trips for ML processing
 */
export const loadAllCompletedTrips = async (
  ctx: ActionCtx,
  logger: PipelineLogger
): Promise<VesselTrip[]> => {
  logger.logStepStart("loadAllTrips");

  const allTrips: VesselTrip[] = [];
  let cursor: string | undefined;
  let batchCount = 0;
  const BATCH_SIZE = 500; // Smaller batch size to manage memory

  try {
    logger.info(
      "Loading all available training data for comprehensive model training"
    );

    while (true) {
      batchCount++;

      // Load next batch
      const batch = await ctx.runQuery(
        api.functions.vesselTrips.queries.getCompletedTripsPaginated,
        { cursor, limit: BATCH_SIZE }
      );

      // Convert to domain format with correct type for map
      const domainTrips = batch.page.map((trip) =>
        toDomainVesselTrip(trip as ConvexVesselTrip)
      );
      allTrips.push(...domainTrips);

      logger.debug(`Batch ${batchCount} loaded`, {
        batchNumber: batchCount,
        batchSize: domainTrips.length,
        totalLoaded: allTrips.length,
        isDone: batch.isDone,
      });

      // Check if we're done
      if (batch.isDone) {
        break;
      }

      cursor = batch.continueCursor;

      // Safety check to prevent excessive data loading
      // Allow up to 50 batches (25K records) for comprehensive training
      if (batchCount > 50) {
        logger.warn("Reached maximum batch limit for comprehensive training", {
          batchCount,
          totalLoaded: allTrips.length,
          maxBatches: 50,
        });
        break;
      }
    }

    logger.logStepEnd("loadAllTrips", 0, {
      totalTrips: allTrips.length,
      batchesProcessed: batchCount,
      note: "Loaded all available training data for comprehensive model training",
    });

    return allTrips;
  } catch (error) {
    logger.logError(error as Error | string, "loadAllTrips", undefined, {
      batchCount,
      totalLoaded: allTrips.length,
    });
    throw error;
  }
};
