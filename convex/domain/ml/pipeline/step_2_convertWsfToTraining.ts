// ============================================================================
/** biome-ignore-all lint/style/noNonNullAssertion: Checking for null values is done in the code */
// STEP 2: CONVERT WSF RECORDS TO TRAINING DATA
// Converts raw WSF records to TrainingDataRecord format with minimal filtering
// ============================================================================

import type { TrainingDataRecord } from "domain/ml/types";
import { VALID_PASSENGER_TERMINALS } from "./shared/config";

/**
 * Terminal mapping for WSF record conversion
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
 * Convert WSF records to TrainingDataRecord format with minimal filtering
 */
export const convertWsfDataToTrainingRecords = (
  wsfRecords: Awaited<
    ReturnType<
      typeof import("ws-dottie/wsf-vessels/core").fetchVesselHistoriesByVesselAndDates
    >
  >
): TrainingDataRecord[] => {
  console.log(
    `Converting ${wsfRecords.length} WSF records to training records`
  );

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
      const departingAbbrev = getTerminalAbbrev(current.Departing || "");
      const arrivingAbbrev = getTerminalAbbrev(current.Arriving || "");

      // SKIP if terminals not found in mapping
      if (!departingAbbrev || !arrivingAbbrev) {
        // Don't log when arriving terminal is null (expected case)
        if (current.Arriving !== null && current.Arriving !== undefined) {
          console.warn(`Skipping record due to unmapped terminals`, {
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
        continue;
      }

      // Basic data completeness check
      if (
        !previous.EstArrival ||
        !current.EstArrival ||
        !current.ActualDepart ||
        !current.ScheduledDepart
      ) {
        continue;
      }

      // Calculate departure delay
      const departureDelay =
        (current.ActualDepart.getTime() - current.ScheduledDepart.getTime()) /
        (1000 * 60); // minutes

      // Calculate at-sea duration
      const atSeaDuration = calculateAtSeaDuration(current);

      records.push({
        departingTerminalAbbrev: departingAbbrev,
        arrivingTerminalAbbrev: arrivingAbbrev,
        tripStart: previous.EstArrival, // Previous trip's EstArrival
        leftDock: current.ActualDepart,
        tripEnd: current.EstArrival,
        schedDeparture: current.ScheduledDepart,
        prevLeftDock: previous.ActualDepart || null,
        prevSchedDeparture: previous.ScheduledDepart || null,
        departureDelay,
        atSeaDuration,
      });
    }
  }

  console.log(
    `Converted to ${records.length} training records (${((records.length / wsfRecords.length) * 100).toFixed(1)}% of input)`
  );

  return records;
};

/**
 * Get terminal abbreviation for a given name
 */
const getTerminalAbbrev = (terminalName: string): string | undefined => {
  const abbrev =
    VESSEL_HISTORIES_TERMINAL_MAPPING[terminalName] ||
    VESSEL_HISTORIES_TERMINAL_MAPPING[terminalName.toLowerCase()];

  if (!abbrev && terminalName.trim() !== "") {
    console.warn(`Terminal name not found in mapping: ${terminalName}`);
  }

  return abbrev;
};

/**
 * Calculate at-sea duration from WSF record
 */
const calculateAtSeaDuration = (
  record: Awaited<
    ReturnType<
      typeof import("ws-dottie/wsf-vessels/core").fetchVesselHistoriesByVesselAndDates
    >
  >[0]
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
