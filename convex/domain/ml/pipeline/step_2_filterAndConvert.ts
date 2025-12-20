// ============================================================================
/** biome-ignore-all lint/style/noNonNullAssertion: <we need to assert these values are not null> */
// STEP 2: FILTER AND CONVERT TO TRAINING RECORDS
// Apply quality filters and convert to minimal TrainingDataRecord format
// ============================================================================

import { VALID_PASSENGER_TERMINALS } from "domain/ml/pipeline/shared/config";
import type { PipelineLogger } from "domain/ml/pipeline/shared/logging";
import type { TrainingDataRecord } from "domain/ml/types";
import type { VesselTrip } from "functions/vesselTrips/schemas";

/**
 * Apply comprehensive data quality filters and convert to TrainingDataRecord
 */
export const filterAndConvertToTrainingRecords = (
  trips: VesselTrip[],
  logger: PipelineLogger
): TrainingDataRecord[] => {
  logger.logStepStart("filterAndConvert", { inputCount: trips.length });

  const trainingRecords: TrainingDataRecord[] = [];
  let filteredCount = 0;

  for (const trip of trips) {
    // Apply all quality filters
    if (!isValidBasicTrip(trip)) {
      filteredCount++;
      continue;
    }

    if (!isSaneTrip(trip)) {
      filteredCount++;
      continue;
    }

    if (isOutlierTrip(trip)) {
      filteredCount++;
      continue;
    }

    // Calculate departure delay: (actual departure - scheduled departure) in minutes
    const departureDelay =
      trip.LeftDock && trip.ScheduledDeparture
        ? (trip.LeftDock.getTime() - trip.ScheduledDeparture.getTime()) /
          (1000 * 60)
        : null;

    // Convert to minimal training record
    const record: TrainingDataRecord = {
      departingTerminalAbbrev: trip.DepartingTerminalAbbrev!,
      arrivingTerminalAbbrev: trip.ArrivingTerminalAbbrev!,
      tripStart: trip.TripStart!,
      leftDock: trip.LeftDock!,
      tripEnd: trip.TripEnd!, // Added as requested
      scheduledDeparture: trip.ScheduledDeparture!,
      departureDelay,
      atSeaDuration: trip.AtSeaDuration ?? null,
      delay: trip.Delay ?? null, // keep for backward compatibility
    };

    trainingRecords.push(record);
  }

  logger.logStepEnd("filterAndConvert", 0, {
    inputCount: trips.length,
    outputCount: trainingRecords.length,
    filteredCount,
    filterRate: `${(
      ((trips.length - trainingRecords.length) / trips.length) * 100
    ).toFixed(1)}%`,
  });

  return trainingRecords;
};

/**
 * Basic validation for trips (null checks)
 */
const isValidBasicTrip = (trip: VesselTrip): boolean => {
  return !!(
    trip.ArrivingTerminalAbbrev &&
    trip.DepartingTerminalAbbrev &&
    trip.ScheduledDeparture &&
    trip.LeftDock &&
    trip.TripStart &&
    trip.TripEnd && // Added TripEnd validation
    VALID_PASSENGER_TERMINALS.has(trip.DepartingTerminalAbbrev) &&
    VALID_PASSENGER_TERMINALS.has(trip.ArrivingTerminalAbbrev)
  );
};

/**
 * Validates basic trip sanity (arrival before departure, reasonable times)
 */
const isSaneTrip = (trip: VesselTrip): boolean => {
  // Arrival must be before departure
  if (trip.TripStart && trip.LeftDock && trip.TripStart >= trip.LeftDock) {
    return false;
  }

  // Departure must be before arrival at destination
  if (trip.LeftDock && trip.TripEnd && trip.LeftDock >= trip.TripEnd) {
    return false;
  }

  // Scheduled departure should be reasonable (within 24 hours of actual arrival)
  if (
    trip.ScheduledDeparture &&
    trip.TripStart &&
    Math.abs(trip.ScheduledDeparture.getTime() - trip.TripStart.getTime()) >
      24 * 60 * 60 * 1000
  ) {
    return false;
  }

  return true;
};

/**
 * Identifies outlier trips that should be excluded from training
 */
const isOutlierTrip = (trip: VesselTrip): boolean => {
  // Calculate durations
  const atDockDuration = trip.AtDockDuration;
  const atSeaDuration = trip.AtSeaDuration;
  const delay = trip.Delay;

  // Outlier checks
  if (delay && Math.abs(delay) > 120) return true; // > 2 hours delay
  if (atDockDuration && (atDockDuration < 0 || atDockDuration > 12 * 60))
    return true; // Negative or > 12 hours
  if (atSeaDuration && (atSeaDuration < 1 || atSeaDuration > 24 * 60))
    return true; // < 1 minute or > 24 hours

  return false;
};
