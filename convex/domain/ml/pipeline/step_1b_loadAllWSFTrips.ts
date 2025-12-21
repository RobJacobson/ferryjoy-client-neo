// ============================================================================
/** biome-ignore-all lint/style/noNonNullAssertion: Checking for null values is done in the code */
// STEP 1B: LOAD ALL TRIPS FROM WSF API
// Fetches vessel histories from WSF backend and converts to TrainingDataRecord[]
// ============================================================================

import type { TrainingDataRecord } from "domain/ml/types";
import {
  fetchVesselBasics,
  fetchVesselHistoriesByVesselAndDates,
} from "ws-dottie/wsf-vessels/core";
import { PIPELINE_CONFIG, VALID_PASSENGER_TERMINALS } from "./shared/config";
import type { PipelineLogger } from "./shared/logging";

/**
 * Terminal mapping cache to avoid repeated API calls
 */
let terminalMappingCache: Record<string, string> | null = null;

/**
 * Load all trips from WSF API and convert to training records
 */
export const loadAllWSFTrips = async (
  _ctx: unknown, // Not used for WSF, but kept for interface consistency
  logger: PipelineLogger
): Promise<TrainingDataRecord[]> => {
  logger.logStepStart("loadAllWSFTrips", {
    daysBack: PIPELINE_CONFIG.DAYS_BACK,
  });

  try {
    // Build terminal mapping
    const terminalMapping = await buildTerminalMapping(logger);

    // Get all vessels
    const vessels = await fetchVesselFleet(logger);

    // Fetch and transform data for all vessels
    const allRecords: TrainingDataRecord[] = [];

    for (const vessel of vessels) {
      try {
        const vesselRecords = await fetchAndTransformVesselData(
          vessel.VesselName,
          terminalMapping,
          logger
        );
        allRecords.push(...vesselRecords);
      } catch (error) {
        logger.error(
          `Failed to process vessel ${vessel.VesselName || "unknown"}`,
          {
            error: String(error),
          }
        );
        // Continue with other vessels
      }
    }

    logger.logStepEnd("loadAllWSFTrips", 0, {
      vesselsProcessed: vessels.length,
      totalRecords: allRecords.length,
    });

    return allRecords;
  } catch (error) {
    logger.error("WSF data loading failed", { error: String(error) });
    throw error;
  }
};

/**
 * Source of truth mapping for terminal names as returned by fetchVesselHistoriesByVesselAndDates
 * to their standard abbreviations. This mapping was created by analyzing vessel history data
 * from 2025-12-19 across all active vessels in the WSF fleet.
 */
const VESSEL_HISTORIES_TERMINAL_MAPPING: Record<string, string> = {
  // Puget Sound region
  Bainbridge: "BBI",
  Bremerton: "BRE",
  Kingston: "KIN",
  Edmonds: "EDM",
  Mukilteo: "MUK",
  Clinton: "CLI",
  Fauntleroy: "FAU",
  Vashon: "VAI",
  Colman: "P52",
  Southworth: "SOU",
  "Pt. Defiance": "PTD",
  Tahlequah: "TAH",

  // San Juan Islands
  Anacortes: "ANA",
  Friday: "FRH", // Note: vessel histories may return "Friday Harbor" or "Friday"
  "Friday Harbor": "FRH",
  Shaw: "SHI",
  Orcas: "ORI",
  Lopez: "LOP",

  // Other
  "Port Townsend": "POT",
  Keystone: "COU",
  "Sidney B.C.": "SID",
};

/**
 * Build terminal name to abbreviation mapping using VESSEL_HISTORIES_TERMINAL_MAPPING as source of truth
 */
const buildTerminalMapping = async (
  logger: PipelineLogger
): Promise<Record<string, string>> => {
  if (terminalMappingCache) {
    return terminalMappingCache;
  }

  logger.info("Building terminal name to abbreviation mapping");

  try {
    const mapping: Record<string, string> = {};

    // Add vessel histories mapping (comprehensive source of truth)
    Object.assign(mapping, VESSEL_HISTORIES_TERMINAL_MAPPING);

    terminalMappingCache = mapping;
    logger.info(
      `Built terminal mapping with ${Object.keys(mapping).length} entries from vessel histories`
    );

    return mapping;
  } catch (error) {
    logger.error("Failed to build terminal mapping", { error: String(error) });
    throw error;
  }
};

/**
 * Get terminal abbreviation for a given name
 * Logs warning and returns undefined if not found
 */
const getTerminalAbbrev = (
  terminalName: string,
  mapping: Record<string, string>,
  logger: PipelineLogger
): string | undefined => {
  const abbrev = mapping[terminalName] || mapping[terminalName.toLowerCase()];

  if (!abbrev) {
    // Don't log for empty terminal names (expected when arriving is null)
    if (terminalName.trim() !== "") {
      logger.warn(`Terminal name not found in mapping: ${terminalName}`);
    }
    return undefined;
  }

  return abbrev;
};

/**
 * Fetch all vessels from WSF
 */
const fetchVesselFleet = async (
  logger: PipelineLogger
): Promise<ReturnType<typeof fetchVesselBasics>> => {
  logger.info("Fetching vessel fleet from WSF");

  try {
    const vessels = await fetchVesselBasics();
    logger.info(`Fetched ${vessels.length} vessels from WSF`);
    return vessels;
  } catch (error) {
    logger.error("Failed to fetch vessel fleet", { error: String(error) });
    throw error;
  }
};

/**
 * Fetch and transform data for a single vessel
 */
const fetchAndTransformVesselData = async (
  vesselName: string | null,
  terminalMapping: Record<string, string>,
  logger: PipelineLogger
): Promise<TrainingDataRecord[]> => {
  logger.debug(`Fetching data for vessel: ${vesselName}`);

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

    // Transform to training records
    const trainingRecords = transformWSFRecordsToTrainingRecords(
      historyRecords,
      terminalMapping,
      logger
    );

    logger.debug(
      `Transformed ${historyRecords.length} WSF records to ${trainingRecords.length} training records for ${vesselName}`
    );

    return trainingRecords;
  } catch (error) {
    logger.error(`Failed to fetch/transform data for vessel ${vesselName}`, {
      error: String(error),
    });
    throw error;
  }
};

/**
 * Transform WSF records to TrainingDataRecord format
 */
const transformWSFRecordsToTrainingRecords = (
  wsfRecords: Awaited<ReturnType<typeof fetchVesselHistoriesByVesselAndDates>>,
  terminalMapping: Record<string, string>,
  logger: PipelineLogger
): TrainingDataRecord[] => {
  const records: TrainingDataRecord[] = [];

  // Group by vessel (though API returns chronological per vessel)
  const vesselGroups = groupBy(wsfRecords, "Vessel");

  for (const [vesselName, vesselTrips] of Object.entries(vesselGroups)) {
    // Ensure chronological order
    const sortedTrips = vesselTrips.sort(
      (a, b) =>
        (a.ScheduledDepart?.getTime() || 0) -
        (b.ScheduledDepart?.getTime() || 0)
    );

    for (let i = 0; i < sortedTrips.length; i++) {
      const current = sortedTrips[i];

      // SKIP if no previous trip (no TripStart available)
      if (i === 0) continue;

      const previous = sortedTrips[i - 1];

      // Map terminal names to abbreviations
      const departingAbbrev = getTerminalAbbrev(
        current.Departing || "",
        terminalMapping,
        logger
      );
      const arrivingAbbrev = getTerminalAbbrev(
        current.Arriving || "",
        terminalMapping,
        logger
      );

      // SKIP if terminals not found in mapping
      if (!departingAbbrev || !arrivingAbbrev) {
        // Don't log when arriving terminal is null (expected case)
        if (current.Arriving !== null && current.Arriving !== undefined) {
          logger.warn(`Skipping record due to unmapped terminals`, {
            vessel: vesselName,
            departing: current.Departing,
            arriving: current.Arriving,
          });
        }
        continue;
      }

      // SKIP if terminals not in valid passenger terminals
      if (
        !VALID_PASSENGER_TERMINALS.has(departingAbbrev) ||
        !VALID_PASSENGER_TERMINALS.has(arrivingAbbrev)
      ) {
        logger.debug(`Skipping record with invalid terminals`, {
          vessel: vesselName,
          departing: departingAbbrev,
          arriving: arrivingAbbrev,
        });
        continue;
      }

      // Calculate departure delay
      const scheduledDepart = current.ScheduledDepart;
      const actualDepart = current.ActualDepart;
      const departureDelay =
        scheduledDepart && actualDepart
          ? (actualDepart.getTime() - scheduledDepart.getTime()) / (1000 * 60) // minutes
          : null;

      // Calculate at-sea duration
      const atSeaDuration = calculateAtSeaDuration(current);

      if (
        departureDelay !== null &&
        previous.EstArrival &&
        current.EstArrival
      ) {
        records.push({
          departingTerminalAbbrev: departingAbbrev,
          arrivingTerminalAbbrev: arrivingAbbrev,
          tripStart: previous.EstArrival!, // Previous trip's EstArrival
          leftDock: actualDepart!,
          tripEnd: current.EstArrival!,
          scheduledDeparture: scheduledDepart!,
          departureDelay,
          atSeaDuration,
          delay: departureDelay, // legacy field for backward compatibility
        });
      }
    }
  }

  return records;
};

/**
 * Calculate at-sea duration from WSF record
 */
const calculateAtSeaDuration = (
  record: Awaited<ReturnType<typeof fetchVesselHistoriesByVesselAndDates>>[0]
): number | null => {
  try {
    const depart = record.ActualDepart;
    const arrive = record.EstArrival;
    if (!depart || !arrive) return null;
    return (arrive.getTime() - depart.getTime()) / (1000 * 60); // minutes
  } catch {
    return null;
  }
};

/**
 * Group array by key
 */
const groupBy = <T>(array: T[], key: keyof T): Record<string, T[]> => {
  return array.reduce(
    (groups, item) => {
      const groupKey = String(item[key]);
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
      return groups;
    },
    {} as Record<string, T[]>
  );
};
