// ============================================================================
/** biome-ignore-all lint/style/noNonNullAssertion: Checking for null values is done in the code */
// STEP 2: CONVERT WSF RECORDS TO TRAINING DATA
// Converts raw WSF records to TrainingDataRecord format with minimal filtering
// ============================================================================

import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";
import type { TrainingDataRecord } from "../types";
import {
  MAX_DURATION_THRESHOLDS,
  MEAN_AT_DOCK_DURATION,
  MIN_DURATION_THRESHOLDS,
  VALID_PASSENGER_TERMINALS,
} from "./shared/config";
import {
  extractTimeFeatures,
  getMinutesDelta,
  getPacificTime,
} from "./shared/time";

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
 * Terminal abbreviations for a trip pair
 */
type TerminalAbbrevs = {
  departing: string;
  arriving: string;
  previousArriving: string;
};

/**
 * Calculated durations and delays for a trip pair
 */
type TripCalculations = {
  prevDelay: number;
  prevAtSeaDuration: number;
  currAtDockDuration: number;
  currDelay: number;
  currAtSeaDuration: number;
  arriveBeforeMinutes: number;
  arriveEarlyMinutes: number;
};

/**
 * Check if all required terminal mappings exist
 */
const hasValidTerminalMappings = (
  abbrevs: TerminalAbbrevs | null
): abbrevs is TerminalAbbrevs => {
  return (
    abbrevs !== null &&
    !!abbrevs.departing &&
    !!abbrevs.arriving &&
    !!abbrevs.previousArriving
  );
};

/**
 * Get terminal abbreviations for current and previous trips
 */
const getTerminalAbbrevs = (
  curr: VesselHistory,
  prev: VesselHistory
): TerminalAbbrevs | null => {
  const departing = getTerminalAbbrev(curr.Departing || "");
  const arriving = getTerminalAbbrev(curr.Arriving || "");
  const previousArriving = getTerminalAbbrev(prev.Arriving || "");

  // If any terminal is unmapped, return null
  if (!departing || !arriving || !previousArriving) {
    // Only warn if it's an actual unmapped terminal issue (not expected null prev.Arriving)
    const isExpectedNull = !previousArriving && prev.Arriving === null;
    if (!isExpectedNull) {
      console.warn(`Skipping record due to unmapped terminals`, {
        departing: curr.Departing,
        arriving: curr.Arriving,
      });
    }
    return null;
  }

  return { departing, arriving, previousArriving };
};

/**
 * Check if terminals are valid passenger terminals
 */
const areTerminalsValid = (abbrevs: TerminalAbbrevs): boolean => {
  return (
    VALID_PASSENGER_TERMINALS.has(abbrevs.departing) &&
    VALID_PASSENGER_TERMINALS.has(abbrevs.arriving) &&
    VALID_PASSENGER_TERMINALS.has(abbrevs.previousArriving)
  );
};

/**
 * Check if trips are consecutive (previous arrival matches current departure)
 * CRITICAL: This ensures consecutive trips are actually connected (same terminal between trips).
 * Without this check, if a trip is filtered out, the next trip would incorrectly reference
 * a non-consecutive previous trip, causing incorrect data for ALL models:
 * - arrive-depart: prevDelay would be from wrong trip
 * - depart-arrive: tripStart would be from wrong terminal
 * - arrive-arrive: atDockDuration would be calculated incorrectly
 * - depart-depart: prevLeftDock would be from wrong trip
 */
const areTripsConsecutive = (abbrevs: TerminalAbbrevs): boolean => {
  return abbrevs.previousArriving === abbrevs.departing;
};

/**
 * Check if all required data fields are present
 */
const hasRequiredData = (curr: VesselHistory, prev: VesselHistory): boolean => {
  return !!(
    prev.EstArrival &&
    curr.EstArrival &&
    curr.ActualDepart &&
    curr.ScheduledDepart &&
    prev.ActualDepart &&
    prev.ScheduledDepart
  );
};

/**
 * Calculate all durations and delays for a trip pair
 * Note: This function assumes required data has been validated via hasRequiredData()
 */
const calculateTripDurations = (
  curr: VesselHistory,
  prev: VesselHistory,
  terminalPairKey: string
): TripCalculations => {
  // Non-null assertions are safe here because hasRequiredData() validates these fields exist
  const prevDelay = getMinutesDelta(prev.ScheduledDepart!, prev.ActualDepart!);
  const prevLeftDock = prev.ActualDepart!; // Previous trip's ActualDepart (for depart-depart features)
  const prevAtSeaDuration = getMinutesDelta(prevLeftDock, prev.EstArrival!); // Minutes from previous trip's departure to previous trip's arrival (for depart-depart target)
  const currAtDockDuration = getMinutesDelta(
    prev.EstArrival!,
    curr.ActualDepart!
  ); // Minutes from trip start (arrival) to left dock (current trip)
  const currDelay = getMinutesDelta(curr.ScheduledDepart!, curr.ActualDepart!);
  const currAtSeaDuration = getMinutesDelta(
    curr.ActualDepart!,
    curr.EstArrival!
  ); // Minutes from left dock to trip end (current trip)

  const arriveBeforeMinutes =
    (curr.ScheduledDepart!.getTime() - curr.EstArrival!.getTime()) / 60000;
  const meanAtDockDuration = MEAN_AT_DOCK_DURATION[terminalPairKey] || 0;
  const arriveEarlyMinutes = meanAtDockDuration - arriveBeforeMinutes;

  return {
    prevDelay,
    prevAtSeaDuration,
    currAtDockDuration,
    currDelay,
    currAtSeaDuration,
    arriveBeforeMinutes,
    arriveEarlyMinutes,
  };
};

/**
 * Check if calculated durations are within valid thresholds
 */
const areDurationsValid = (calc: TripCalculations): boolean => {
  if (calc.currAtSeaDuration < MIN_DURATION_THRESHOLDS.AT_SEA) {
    return false; // Skip records where vessel was at sea for less than 2 minutes
  }
  if (calc.currAtDockDuration < MIN_DURATION_THRESHOLDS.AT_DOCK) {
    return false; // Skip records where vessel was at dock for less than 2 minutes
  }
  if (calc.currAtDockDuration > MAX_DURATION_THRESHOLDS.AT_DOCK) {
    return false; // Skip records with overnight layovers or extended maintenance (>3 hours at dock)
  }
  if (calc.currAtSeaDuration > MAX_DURATION_THRESHOLDS.AT_SEA) {
    return false; // Skip records with data errors (>24 hours at sea)
  }
  // Filter arrive-arrive outliers (total time from arrival to next arrival)
  const arriveArriveTotal = calc.currAtDockDuration + calc.currAtSeaDuration;
  if (arriveArriveTotal > MAX_DURATION_THRESHOLDS.ARRIVE_ARRIVE_TOTAL) {
    return false; // Skip records with extreme arrive-arrive durations (>2 hours total)
  }

  return true;
};

/**
 * Create a training record from validated trip data
 */
const createTrainingRecord = (
  abbrevs: TerminalAbbrevs,
  calc: TripCalculations,
  schedDeparture: Date
): TrainingDataRecord => {
  const schedDeparturePacificTime = getPacificTime(schedDeparture);
  const dayOfWeek = schedDeparturePacificTime.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0;
  const schedDepartureTimeFeatures = extractTimeFeatures(
    schedDeparturePacificTime
  );

  return {
    departingTerminalAbbrev: abbrevs.departing,
    arrivingTerminalAbbrev: abbrevs.arriving,
    prevDelay: calc.prevDelay,
    prevAtSeaDuration: calc.prevAtSeaDuration,
    currAtDockDuration: calc.currAtDockDuration,
    currDelay: calc.currDelay,
    currAtSeaDuration: calc.currAtSeaDuration,
    isWeekend,
    schedDepartureTimeFeatures,
    schedDepartureTimestamp: schedDeparture.getTime(),
    arriveEarlyMinutes: calc.arriveEarlyMinutes,
    arriveBeforeMinutes: calc.arriveBeforeMinutes,
  };
};

/**
 * Process a single trip pair and return a training record or null
 */
const processTripPair = (
  curr: VesselHistory,
  prev: VesselHistory
): TrainingDataRecord | null => {
  // Validate terminal mappings
  const abbrevs = getTerminalAbbrevs(curr, prev);
  if (!hasValidTerminalMappings(abbrevs)) {
    return null;
  }

  // Validate terminals are passenger terminals
  if (!areTerminalsValid(abbrevs)) {
    return null;
  }

  // Validate trips are consecutive
  if (!areTripsConsecutive(abbrevs)) {
    return null;
  }

  // Validate required data exists
  if (!hasRequiredData(curr, prev)) {
    return null;
  }

  // Calculate durations
  const terminalPairKey = `${abbrevs.departing}->${abbrevs.arriving}`;
  const calc = calculateTripDurations(curr, prev, terminalPairKey);

  // Validate durations
  if (!areDurationsValid(calc)) {
    return null;
  }

  // Create and return training record
  // Non-null assertion is safe here because hasRequiredData() validates ScheduledDepart exists
  return createTrainingRecord(abbrevs, calc, curr.ScheduledDepart!);
};

/**
 * Process all trips for a single vessel
 */
const processVesselTrips = (trips: VesselHistory[]): TrainingDataRecord[] => {
  const sortedTrips = trips.sort(
    (a, b) =>
      (a.ScheduledDepart?.getTime() || 0) - (b.ScheduledDepart?.getTime() || 0)
  );

  const records: TrainingDataRecord[] = [];
  for (let i = 1; i < sortedTrips.length; i++) {
    const record = processTripPair(sortedTrips[i], sortedTrips[i - 1]);
    if (record) {
      records.push(record);
    }
  }
  return records;
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

  const vesselGroups = groupBy(wsfRecords, "Vessel");

  const records = Object.values(vesselGroups).flatMap(processVesselTrips);

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
