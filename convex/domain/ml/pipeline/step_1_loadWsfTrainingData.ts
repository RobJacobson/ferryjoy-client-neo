// ============================================================================
/** biome-ignore-all lint/style/noNonNullAssertion: Checking for null values is done in the code */
// STEP 1: LOAD TRAINING DATA FROM WSF API
// Fetches vessel histories from WSF backend and returns raw WSF records
// ============================================================================

import {
  fetchVesselBasics,
  fetchVesselHistoriesByVesselAndDates,
} from "ws-dottie/wsf-vessels/core";
import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";
import { PIPELINE_CONFIG } from "./shared/config";

/**
 * Load all vessel history records from WSF API
 */
export const loadWsfTrainingData = async (): Promise<VesselHistory[]> => {
  console.log("Loading all vessel history records from WSF API...");

  try {
    // Get all vessels
    const vessels = await fetchVesselFleet();

    // Process vessels in batches to manage memory
    const VESSEL_BATCH_SIZE = 2; // Process 2 vessels at a time
    const allRecords: VesselHistory[] = [];
    let successCount = 0;
    let failureCount = 0;
    let batchCount = 0;

    console.log(
      `Processing ${vessels.length} vessels in batches of ${VESSEL_BATCH_SIZE}`
    );

    for (let i = 0; i < vessels.length; i += VESSEL_BATCH_SIZE) {
      batchCount++;
      const vesselBatch = vessels.slice(i, i + VESSEL_BATCH_SIZE);

      console.log(
        `Processing vessel batch ${batchCount}: vessels ${i + 1}-${i + vesselBatch.length}/${vessels.length}`
      );

      // Process this batch in parallel
      const vesselPromises = vesselBatch.map((vessel) =>
        fetchVesselData(vessel.VesselName)
      );

      const vesselResults = await Promise.allSettled(vesselPromises);

      // Collect results from this batch
      for (let j = 0; j < vesselResults.length; j++) {
        const result = vesselResults[j];
        const vessel = vesselBatch[j];

        if (result.status === "fulfilled") {
          allRecords.push(...result.value);
          successCount++;
        } else {
          console.error(
            `Failed to fetch vessel ${vessel.VesselName || "unknown"}`,
            { error: String(result.reason) }
          );
          failureCount++;
        }
      }

      // Memory safety check - prevent excessive memory usage
      if (allRecords.length > 50000) {
        // 50K records limit
        console.warn("Reached maximum record limit for memory safety", {
          totalRecords: allRecords.length,
          vesselsProcessed: successCount + failureCount,
          totalVessels: vessels.length,
        });
        break;
      }
    }

    console.log(
      `Batch processing completed: ${successCount} successful, ${failureCount} failed`
    );
    console.log(`Loaded data: ${allRecords.length} WSF records from WSF API`);

    return allRecords;
  } catch (error) {
    console.error("WSF data loading failed", { error: String(error) });
    throw error;
  }
};

/**
 * Fetch all vessels from WSF
 */
const fetchVesselFleet = async (): Promise<
  ReturnType<typeof fetchVesselBasics>
> => {
  console.log("Fetching vessel fleet from WSF");

  try {
    const vessels = await fetchVesselBasics();
    console.log(`Fetched ${vessels.length} vessels from WSF`);
    return vessels;
  } catch (error) {
    console.error("Failed to fetch vessel fleet", { error: String(error) });
    throw error;
  }
};

/**
 * Fetch vessel history data for a single vessel
 */
const fetchVesselData = async (
  vesselName: string | null
): Promise<VesselHistory[]> => {
  console.log(`Fetching data for vessel: ${vesselName}`);

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date(
    endDate.getTime() - PIPELINE_CONFIG.DAYS_BACK * 24 * 60 * 60 * 1000
  );

  try {
    // Fetch vessel history
    const historyRecords = await fetchVesselHistoriesByVesselAndDates({
      params: {
        VesselName: vesselName || "",
        DateStart: startDate.toISOString().split("T")[0], // YYYY-MM-DD format
        DateEnd: endDate.toISOString().split("T")[0], // YYYY-MM-DD format
      },
    });

    console.log(
      `Fetched ${historyRecords.length} WSF records for ${vesselName}`
    );

    // Apply sampling strategy to manage data volume
    const sampledRecords = applySamplingStrategy(historyRecords);

    if (sampledRecords.length < historyRecords.length) {
      console.log(
        `Sampled down to ${sampledRecords.length} records for ${vesselName} (${PIPELINE_CONFIG.SAMPLING_STRATEGY})`
      );
    }

    return sampledRecords;
  } catch (error) {
    console.error(`Failed to fetch data for vessel ${vesselName}`, {
      error: String(error),
    });
    throw error;
  }
};

/**
 * Apply sampling strategy to reduce data volume while preserving information
 */
const applySamplingStrategy = (records: VesselHistory[]): VesselHistory[] => {
  const maxRecords = PIPELINE_CONFIG.MAX_RECORDS_PER_VESSEL;

  if (records.length <= maxRecords) {
    return records; // No sampling needed
  }

  // Sort by date (most recent first)
  const sortedRecords = records.sort((a, b) => {
    const dateA = a.ScheduledDepart?.getTime() || 0;
    const dateB = b.ScheduledDepart?.getTime() || 0;
    return dateB - dateA; // Most recent first
  });

  if (PIPELINE_CONFIG.SAMPLING_STRATEGY === "recent_first") {
    // Keep the most recent records up to the limit
    return sortedRecords.slice(0, maxRecords);
  }

  // Default: return all records if strategy not recognized
  console.warn(
    `Unknown sampling strategy: ${PIPELINE_CONFIG.SAMPLING_STRATEGY}, returning unsampled data`
  );
  return records;
};
