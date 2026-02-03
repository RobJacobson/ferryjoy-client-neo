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
import { getSailingDay } from "../../../../shared/time";
import { config } from "../../shared/config";

/**
 * Safely stringify objects that may contain circular references or bigints.
 *
 * @param value - Value to stringify
 * @returns JSON string representation
 */
const safeJsonStringify = (value: unknown): string => {
  const seen = new WeakSet<object>();
  return JSON.stringify(
    value,
    (_key, v) => {
      if (typeof v === "bigint") {
        return String(v);
      }
      if (typeof v === "object" && v !== null) {
        if (seen.has(v)) {
          return "[Circular]";
        }
        seen.add(v);
      }
      if (v instanceof Error) {
        return {
          name: v.name,
          message: v.message,
          stack: v.stack,
        };
      }
      return v;
    },
    2
  );
};

/**
 * Format unknown error values into structured error information.
 *
 * @param error - Error value to format
 * @returns Structured error information
 */
const formatUnknownError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      kind: "Error",
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    return {
      kind: "object",
      keys: Object.keys(record).sort(),
      // Common fields we often see from fetch / HTTP wrappers:
      message: record.message,
      status: record.status,
      statusText: record.statusText,
      url: record.url,
      cause: record.cause,
      raw: safeJsonStringify(record),
    };
  }

  return {
    kind: typeof error,
    message: String(error),
  };
};

/**
 * Load all vessel history records from WSF API
 * Fails immediately if any vessel data fetch fails (data integrity requirement)
 */
export const loadWsfTrainingData = async (options?: {
  sampleRecords?: boolean;
}): Promise<VesselHistory[]> => {
  const sampleRecords = options?.sampleRecords ?? true;
  console.log("Loading all vessel history records from WSF API...");

  try {
    // Get all vessels
    const vessels = await fetchVesselFleet();

    // Process vessels in batches to manage memory
    const VESSEL_BATCH_SIZE = 2; // Process 2 vessels at a time
    const allRecords: VesselHistory[] = [];

    console.log(
      `Processing ${vessels.length} vessels in batches of ${VESSEL_BATCH_SIZE}`
    );

    for (let i = 0; i < vessels.length; i += VESSEL_BATCH_SIZE) {
      const vesselBatch = vessels.slice(i, i + VESSEL_BATCH_SIZE);
      const batchNumber = Math.floor(i / VESSEL_BATCH_SIZE) + 1;

      console.log(
        `Processing vessel batch ${batchNumber}: vessels ${i + 1}-${i + vesselBatch.length}/${vessels.length}`
      );

      // Process this batch in parallel - fail immediately on any error
      const vesselPromises = vesselBatch.map((vessel) =>
        fetchVesselData(vessel.VesselName, { sampleRecords })
      );

      // Use Promise.all (not allSettled) to fail fast on errors
      const batchResults = await Promise.all(vesselPromises);
      allRecords.push(...batchResults.flat());

      // Memory safety check - prevent excessive memory usage
      if (
        allRecords.length >
        config.getMaxRecordsPerVessel() * vessels.length
      ) {
        console.warn("Reached maximum record limit for memory safety", {
          totalRecords: allRecords.length,
          vesselsProcessed: i + vesselBatch.length,
          totalVessels: vessels.length,
        });
        break;
      }
    }

    console.log(`Loaded data: ${allRecords.length} WSF records from WSF API`);
    return allRecords;
  } catch (error) {
    const formatted = formatUnknownError(error);
    console.error("WSF data loading failed", {
      error: formatted,
    });
    // Ensure the surfaced error message is informative even if the runtime
    // renders nested objects poorly (e.g. "[object Object]").
    throw new Error(
      `Failed to load vessel data: ${safeJsonStringify(formatted)}`
    );
  }
};

/**
 * Fetch all vessels from WSF API.
 * @returns Array of vessel basic information
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
    const formatted = formatUnknownError(error);
    console.error("Failed to fetch vessel fleet", {
      error: formatted,
    });
    throw new Error(
      `Failed to fetch vessel fleet: ${safeJsonStringify(formatted)}`
    );
  }
};

/**
 * Fetch vessel history data for a single vessel within the training date range.
 *
 * @param vesselName - Name of the vessel to fetch data for
 * @returns Array of vessel history records for the specified vessel
 */
const fetchVesselData = async (
  vesselName: string | null,
  options?: { sampleRecords?: boolean }
): Promise<VesselHistory[]> => {
  const sampleRecords = options?.sampleRecords ?? true;
  console.log(`Fetching data for vessel: ${vesselName}`);

  // Calculate date range using sailing day logic
  const now = new Date();
  const endDateStr = getSailingDay(now);
  const startDateStr = getSailingDay(
    new Date(now.getTime() - config.getDaysBack() * 24 * 60 * 60 * 1000)
  );

  try {
    // Fetch vessel history
    const historyRecords = await fetchVesselHistoriesByVesselAndDates({
      params: {
        VesselName: vesselName || "",
        DateStart: startDateStr,
        DateEnd: endDateStr,
      },
    });

    console.log(
      `Fetched ${historyRecords.length} WSF records for ${vesselName}`
    );

    // Apply sampling strategy to manage data volume
    const sampledRecords = sampleRecords
      ? applySamplingStrategy(historyRecords)
      : historyRecords;

    if (sampledRecords.length < historyRecords.length) {
      console.log(
        `Sampled down to ${sampledRecords.length} records for ${vesselName} (${config.getSamplingStrategy()})`
      );
    }

    return sampledRecords;
  } catch (error) {
    const formatted = formatUnknownError(error);
    console.error(`Failed to fetch data for vessel ${vesselName}`, {
      vesselName,
      dateStart: startDateStr,
      dateEnd: endDateStr,
      samplingStrategy: config.getSamplingStrategy(),
      maxRecordsPerVessel: config.getMaxRecordsPerVessel(),
      error: formatted,
    });
    throw new Error(
      `Failed to fetch data for vessel ${vesselName}: ${safeJsonStringify(
        formatted
      )}`
    );
  }
};

/**
 * Apply sampling strategy to reduce data volume while preserving information.
 *
 * @param records - Array of vessel history records to sample
 * @returns Sampled array of vessel history records
 */
const applySamplingStrategy = (records: VesselHistory[]): VesselHistory[] => {
  const maxRecords = config.getMaxRecordsPerVessel();

  if (records.length <= maxRecords) {
    return records; // No sampling needed
  }

  // Sort by date (most recent first)
  const sortedRecords = records.sort((a, b) => {
    const dateA = a.ScheduledDepart?.getTime() || 0;
    const dateB = b.ScheduledDepart?.getTime() || 0;
    return dateB - dateA; // Most recent first
  });

  if (config.getSamplingStrategy() === "recent_first") {
    // Keep the most recent records up to the limit
    return sortedRecords.slice(0, maxRecords);
  }

  // Default: return all records if strategy not recognized
  console.warn(
    `Unknown sampling strategy: ${config.getSamplingStrategy()}, returning unsampled data`
  );
  return records;
};
