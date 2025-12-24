// ============================================================================
/** biome-ignore-all lint/style/noNonNullAssertion: Checking for null values is done in the code */
// STEP 2: CONVERT WSF RECORDS TO TRAINING DATA
// Converts raw WSF records to TrainingDataRecord format with minimal filtering
// ============================================================================

import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";
import type { TrainingDataRecord } from "../types";
import {
  MEAN_AT_DOCK_DURATION,
  MIN_DURATION_THRESHOLDS,
  VALID_PASSENGER_TERMINALS,
} from "./shared/config";
import { getMinutesDelta } from "./shared/time";

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
  wsfRecords: VesselHistory[]
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

    // Start at index 1 to avoid using the first trip as the previous trip
    for (let i = 1; i < sortedTrips.length; i++) {
      const current = sortedTrips[i];
      const previous = sortedTrips[i - 1];

      // Map terminal names to abbreviations
      const departingTerminalAbbrev = getTerminalAbbrev(
        current.Departing || ""
      );
      const arrivingTerminalAbbrev = getTerminalAbbrev(current.Arriving || "");

      // SKIP if terminals not found in mapping
      if (!departingTerminalAbbrev || !arrivingTerminalAbbrev) {
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
        !VALID_PASSENGER_TERMINALS.has(departingTerminalAbbrev) ||
        !VALID_PASSENGER_TERMINALS.has(arrivingTerminalAbbrev)
      ) {
        continue;
      }

      // Check for missing data
      if (
        !previous.EstArrival ||
        !current.EstArrival ||
        !current.ActualDepart ||
        !current.ScheduledDepart ||
        !previous.ActualDepart ||
        !previous.ScheduledDepart
      ) {
        continue;
      }

      const prevDelay = getMinutesDelta(
        previous.ScheduledDepart,
        previous.ActualDepart
      );
      const tripStart = previous.EstArrival; // Previous trip's EstArrival (trip start time)
      const leftDock = current.ActualDepart; // Current trip's ActualDepart (left dock time)
      const tripEnd = current.EstArrival; // Current trip's EstArrival (trip end time)
      const schedDeparture = current.ScheduledDepart; // Current trip's ScheduledDeparture
      const departureDelay = getMinutesDelta(schedDeparture, leftDock); // Minutes from scheduled departure to left dock
      const atSeaDuration = getMinutesDelta(leftDock, tripEnd); // Minutes from left dock to trip end
      const atDockDuration = getMinutesDelta(tripStart, leftDock); // Minutes from trip start (arrival) to left dock

      // Filter out records with invalid durations (data quality check)
      if (atSeaDuration < MIN_DURATION_THRESHOLDS.AT_SEA) {
        continue; // Skip records where vessel was at sea for less than 2 minutes
      }
      if (atDockDuration < MIN_DURATION_THRESHOLDS.AT_DOCK) {
        continue; // Skip records where vessel was at dock for less than 2 minutes
      }

      const arriveEarlyMin = getMinutesDelta(tripStart, schedDeparture);
      if (arriveEarlyMin > 30) {
        // continue;
      }

      // Get meanAtDockDuration for this terminal pair
      const terminalPairKey = `${departingTerminalAbbrev}_${arrivingTerminalAbbrev}`;
      const meanAtDockDuration = MEAN_AT_DOCK_DURATION[terminalPairKey] ?? 20;

      records.push({
        departingTerminalAbbrev,
        arrivingTerminalAbbrev,
        prevDelay,
        tripStart,
        leftDock,
        tripEnd,
        schedDeparture,
        departureDelay,
        atSeaDuration,
        meanAtDockDuration,
      });
    }
  }

  console.log(
    `Converted to ${records.length} training records (${((records.length / wsfRecords.length) * 100).toFixed(1)}% of input)`
  );

  return records;
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
