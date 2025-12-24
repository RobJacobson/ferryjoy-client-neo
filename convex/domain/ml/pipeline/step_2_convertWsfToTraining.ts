// ============================================================================
/** biome-ignore-all lint/style/noNonNullAssertion: Checking for null values is done in the code */
// STEP 2: CONVERT WSF RECORDS TO TRAINING DATA
// Converts raw WSF records to TrainingDataRecord format with minimal filtering
// ============================================================================

import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";
import type { TrainingDataRecord } from "../types";
import {
  MEAN_AT_DOCK_DURATION,
  MAX_DURATION_THRESHOLDS,
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
  "Bainbridge Island": "BBI",
  Bremerton: "BRE",
  Kingston: "KIN",
  Edmonds: "EDM",
  Mukilteo: "MUK",
  Clinton: "CLI",
  Fauntleroy: "FAU",
  Vashon: "VAI",
  "Vashon Island": "VAI", // WSF API may return full name
  Colman: "P52",
  Seattle: "P52", // WSF API may return "Seattle" instead of "Colman"
  Southworth: "SOU",
  "Pt. Defiance": "PTD",
  "Point Defiance": "PTD", // WSF API may return full name
  Tahlequah: "TAH",

  // San Juan Islands
  Anacortes: "ANA",
  Friday: "FRH", // Note: vessel histories may return "Friday Harbor" or "Friday"
  "Friday Harbor": "FRH",
  Shaw: "SHI",
  "Shaw Island": "SHI", // WSF API may return full name
  Orcas: "ORI",
  "Orcas Island": "ORI", // WSF API may return full name
  Lopez: "LOP",
  "Lopez Island": "LOP", // WSF API may return full name

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
      const previousArrivingTerminalAbbrev = getTerminalAbbrev(
        previous.Arriving || ""
      );

      // SKIP if terminals not found in mapping
      if (!departingTerminalAbbrev || !arrivingTerminalAbbrev || !previousArrivingTerminalAbbrev) {
        // Log warnings for unmapped terminals (but not for null previous.Arriving, which is expected for in-progress trips)
        if (current.Arriving !== null && current.Arriving !== undefined) {
          if (!previousArrivingTerminalAbbrev && previous.Arriving === null) {
            // Previous trip has no arrival data (likely in-progress) - this is expected, skip silently
          } else {
            // Actual unmapped terminal issue - log warning
            console.warn(`Skipping record due to unmapped terminals`, {
              vessel: vesselName,
              departing: current.Departing,
              arriving: current.Arriving,
              previousArriving: previous.Arriving,
              departingMapped: !!departingTerminalAbbrev,
              arrivingMapped: !!arrivingTerminalAbbrev,
              previousArrivingMapped: !!previousArrivingTerminalAbbrev,
            });
          }
        }
        continue;
      }

      // SKIP if terminals not in valid passenger terminals
      if (
        !VALID_PASSENGER_TERMINALS.has(departingTerminalAbbrev) ||
        !VALID_PASSENGER_TERMINALS.has(arrivingTerminalAbbrev) ||
        !VALID_PASSENGER_TERMINALS.has(previousArrivingTerminalAbbrev)
      ) {
        continue;
      }

      // CRITICAL: Verify that previous trip's arrival terminal matches current trip's departure terminal
      // This ensures consecutive trips are actually connected (same terminal between trips).
      // Without this check, if a trip is filtered out, the next trip would incorrectly reference
      // a non-consecutive previous trip, causing incorrect data for ALL models:
      // - arrive-depart: prevDelay would be from wrong trip
      // - depart-arrive: tripStart would be from wrong terminal
      // - arrive-arrive: atDockDuration would be calculated incorrectly
      // - depart-depart: prevLeftDock would be from wrong trip
      if (previousArrivingTerminalAbbrev !== departingTerminalAbbrev) {
        // Trips are not consecutive - skip this record (prevents cascading data errors)
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
      const prevLeftDock = previous.ActualDepart; // Previous trip's ActualDepart (for depart-depart features)

      // Filter out records with invalid durations (data quality check)
      if (atSeaDuration < MIN_DURATION_THRESHOLDS.AT_SEA) {
        continue; // Skip records where vessel was at sea for less than 2 minutes
      }
      if (atDockDuration < MIN_DURATION_THRESHOLDS.AT_DOCK) {
        continue; // Skip records where vessel was at dock for less than 2 minutes
      }
      if (atDockDuration > MAX_DURATION_THRESHOLDS.AT_DOCK) {
        continue; // Skip records with overnight layovers or extended maintenance (>3 hours at dock)
      }
      if (atSeaDuration > MAX_DURATION_THRESHOLDS.AT_SEA) {
        continue; // Skip records with data errors (>24 hours at sea)
      }
      // Filter arrive-arrive outliers (total time from arrival to next arrival)
      const arriveArriveTotal = atDockDuration + atSeaDuration;
      if (arriveArriveTotal > MAX_DURATION_THRESHOLDS.ARRIVE_ARRIVE_TOTAL) {
        continue; // Skip records with extreme arrive-arrive durations (>2 hours total)
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
        atDockDuration,
        prevLeftDock,
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
