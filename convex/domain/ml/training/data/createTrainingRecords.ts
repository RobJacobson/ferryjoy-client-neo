// ============================================================================
/** biome-ignore-all lint/style/noNonNullAssertion: Checking for null values is done in the code */
// STEP 2: CONVERT WSF RECORDS TO TRAINING DATA
// Converts raw WSF records to TrainingDataRecord format with minimal filtering
// ============================================================================

import { getMinutesDelta, getPacificTime } from "shared/time";
import type { VesselHistory } from "ws-dottie/wsf-vessels/schemas";
import { getConfig } from "../../shared/core/config";
import type { TrainingDataRecord } from "../../shared/core/types";
import { extractTimeFeatures } from "../../shared/features/timeFeatures";

/**
 * Terminal abbreviations for a consecutive trip pair (current + previous trip)
 */
type TerminalAbbrevs = {
  departing: string; // Current trip departure terminal
  arriving: string; // Current trip arrival terminal
  previousArriving: string; // Previous trip arrival terminal (must match current departing)
};

/**
 * Calculated durations and delays for a consecutive trip pair
 */
type TripCalculations = {
  prevDelay: number; // Previous trip delay in minutes
  prevAtSeaDuration: number; // Previous trip at-sea duration in minutes
  currAtDockDuration: number; // Current trip at-dock duration in minutes
  currDelay: number; // Current trip delay in minutes
  currAtSeaDuration: number; // Current trip at-sea duration in minutes
  arriveBeforeMinutes: number; // Minutes before scheduled departure vessel arrived
  arriveEarlyMinutes: number; // How early vessel arrived relative to mean at-dock time
};

/**
 * Convert WSF vessel history records to ML training data format
 *
 * This is the main data transformation step in the ML pipeline that converts raw
 * WSF API data into structured training records suitable for machine learning.
 * The process involves:
 * 1. Grouping records by vessel to process trips chronologically per vessel
 * 2. Converting consecutive trip pairs into training examples with features and targets
 * 3. Applying extensive validation and filtering to ensure data quality
 *
 * Only valid consecutive trip pairs that pass all quality checks become training records.
 * Invalid records are silently filtered out to maintain training data integrity.
 *
 * @param wsfRecords - Raw vessel history records from WSF API
 * @returns Array of validated training data records ready for ML model training
 */
export const createTrainingDataRecords = (
  wsfRecords: VesselHistory[]
): TrainingDataRecord[] => {
  console.log(
    `Converting ${wsfRecords.length} WSF records to training records`
  );

  // Group records by vessel to process each vessel's trips chronologically
  const vesselGroups = groupBy(wsfRecords, "Vessel");

  // Process each vessel's trip history into training records
  // Each vessel's trips are processed independently for data integrity
  const records = Object.values(vesselGroups).flatMap(processVesselTrips);

  console.log(
    `Converted to ${records.length} training records (${((records.length / wsfRecords.length) * 100).toFixed(1)}% of input)`
  );

  return records;
};

/**
 * Process all trips for a single vessel into training records
 *
 * Groups trips chronologically and processes each consecutive pair to create
 * training data. Only consecutive, valid trip pairs become training records.
 *
 * @param trips - Array of WSF trip records for a single vessel
 * @returns Array of training data records (one per valid trip pair)
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
 * Process a single consecutive trip pair into a training record
 *
 * Applies all validation steps and data transformations to convert raw WSF data
 * into a clean training record. Returns null if the trip pair fails any validation.
 *
 * @param curr - Current trip WSF record
 * @param prev - Previous trip WSF record
 * @returns Training data record or null if validation fails
 */
const processTripPair = (
  curr: VesselHistory,
  prev: VesselHistory
): TrainingDataRecord | null => {
  // Step 1: Validate terminal mappings exist
  const abbrevs = getTerminalAbbrevs(curr, prev);
  if (!hasValidTerminalMappings(abbrevs)) {
    return null; // Skip if any terminals unmapped
  }

  // Step 2: Validate terminals are passenger terminals (not maintenance docks)
  if (!areTerminalsValid(abbrevs)) {
    return null; // Skip non-passenger terminals
  }

  // Step 3: Validate trips are consecutive (previous arrival = current departure)
  if (!areTripsConsecutive(abbrevs)) {
    return null; // Critical: ensures trip continuity
  }

  // Step 4: Validate all required timestamp data exists
  if (!hasRequiredData(curr, prev)) {
    return null; // Cannot calculate durations without timestamps
  }

  // Step 5: Calculate all timing metrics (delays, durations, arrival features)
  const terminalPairKey = `${abbrevs.departing}->${abbrevs.arriving}`;
  const calc = calculateTripDurations(curr, prev, terminalPairKey);

  // Step 6: Validate calculated durations are within reasonable bounds
  if (!areDurationsValid(calc)) {
    return null; // Filter out anomalies (overnight layovers, data errors, etc.)
  }

  // Step 7: Create and return validated training record
  // Non-null assertion is safe here because hasRequiredData() validates ScheduledDepart exists
  return createTrainingRecord(abbrevs, calc, curr.ScheduledDepart!);
};

/**
 * Get standardized terminal abbreviation for WSF terminal names
 *
 * Maps various WSF API terminal name formats to standardized abbreviations.
 * Handles full name variants.
 *
 * @param terminalName - Terminal name from WSF API (may include full names or abbreviations)
 * @returns Standardized terminal abbreviation or undefined if not found
 */
const getTerminalAbbrev = (terminalName: string): string | undefined => {
  const abbrev = getConfig.getTerminalAbbrev(terminalName);

  if (!abbrev && terminalName.trim() !== "" && abbrev !== terminalName) {
    console.warn(`Terminal name not found in mapping: ${terminalName}`);
  }

  return abbrev === terminalName ? undefined : abbrev;
};

/**
 * Check if all required terminal mappings exist for trip processing
 *
 * @param abbrevs - Terminal abbreviations for the trip pair
 * @returns True if all terminals are properly mapped, false otherwise
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
 * Extract terminal abbreviations for a consecutive trip pair
 *
 * Maps terminal names from WSF records to standardized abbreviations and validates
 * that the trips are truly consecutive (previous arrival matches current departure).
 *
 * @param curr - Current trip WSF record
 * @param prev - Previous trip WSF record
 * @returns Terminal abbreviations object or null if mapping fails
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
 * Validate that all terminals in the trip pair are passenger terminals
 *
 * Only passenger ferry terminals are included in the ML models. Cargo-only
 * terminals and other facilities are excluded from training data.
 *
 * @param abbrevs - Terminal abbreviations to validate
 * @returns True if all terminals are valid passenger terminals
 */
const areTerminalsValid = (abbrevs: TerminalAbbrevs): boolean => {
  return (
    getConfig.isValidTerminal(abbrevs.departing) &&
    getConfig.isValidTerminal(abbrevs.arriving) &&
    getConfig.isValidTerminal(abbrevs.previousArriving)
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
 * Validate that all required timestamp fields are present for duration calculations
 *
 * Checks that both current and previous trips have the necessary timestamps
 * to calculate delays and durations safely.
 *
 * @param curr - Current trip WSF record
 * @param prev - Previous trip WSF record
 * @returns True if all required data fields are present
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
 * Calculate all durations and delays for a consecutive trip pair
 *
 * Computes timing metrics that will serve as both features and targets for ML models.
 * Assumes hasRequiredData() has already validated that all timestamps exist.
 *
 * @param curr - Current trip WSF record
 * @param prev - Previous trip WSF record
 * @param terminalPairKey - Terminal pair key for mean duration lookups
 * @returns Calculated timing metrics for the trip pair
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
  const meanAtDockDuration = getConfig.getMeanDockDuration(terminalPairKey);
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
 * Validate that calculated durations are within acceptable ranges
 *
 * Filters out anomalous data points that could skew model training, such as
 * overnight layovers, data errors, or unusually short trips.
 *
 * @param calc - Calculated timing metrics for validation
 * @returns True if all durations are within valid thresholds
 */
const areDurationsValid = (calc: TripCalculations): boolean => {
  if (calc.currAtSeaDuration < getConfig.getMinAtSeaDuration()) {
    return false; // Skip records where vessel was at sea for less than 2 minutes
  }
  if (calc.currAtDockDuration < getConfig.getMinAtDockDuration()) {
    return false; // Skip records where vessel was at dock for less than 2 minutes
  }
  if (calc.currAtDockDuration > getConfig.getMaxAtDockDuration()) {
    return false; // Skip records with overnight layovers or extended maintenance (>3 hours at dock)
  }
  if (calc.currAtSeaDuration > getConfig.getMaxAtSeaDuration()) {
    return false; // Skip records with data errors (>24 hours at sea)
  }
  // Filter arrive-arrive outliers (total time from arrival to next arrival)
  const arriveArriveTotal = calc.currAtDockDuration + calc.currAtSeaDuration;
  if (arriveArriveTotal > getConfig.getMaxTotalDuration()) {
    return false; // Skip records with extreme arrive-arrive durations (>2 hours total)
  }

  return true;
};

/**
 * Create a training data record from validated and processed trip data
 *
 * Combines terminal information, calculated durations, and extracted time features
 * into the final format used for ML model training.
 *
 * @param abbrevs - Validated terminal abbreviations
 * @param calc - Calculated timing metrics
 * @param schedDeparture - Scheduled departure date for time feature extraction
 * @returns Complete training data record
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
 * Group array elements by a specified key
 *
 * Utility function to group WSF records by vessel name for chronological processing.
 * Uses modern reduce pattern with optional chaining for safer property access.
 *
 * @param array - Array of objects to group
 * @param key - Property name to group by
 * @returns Object with grouped arrays keyed by the specified property
 */
const groupBy = <T>(array: T[], key: keyof T): Record<string, T[]> => {
  return array.reduce(
    (groups, item) => {
      const groupKey = String(item[key] ?? "unknown");
      groups[groupKey] ??= [];
      groups[groupKey].push(item);
      return groups;
    },
    {} as Record<string, T[]>
  );
};
