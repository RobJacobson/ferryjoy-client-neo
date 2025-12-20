/** biome-ignore-all lint/style/noNonNullAssertion: false positive */
import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { VesselTrip } from "functions/vesselTrips/schemas";
import { toDomainVesselTrip } from "functions/vesselTrips/schemas";
import type {
  TerminalPair,
  TerminalPairTrainingData,
  TrainingExample,
} from "../types";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Valid passenger terminal abbreviations from WSF terminals data
 * Excludes maintenance terminals
 */
const VALID_PASSENGER_TERMINALS = new Set([
  "ANA",
  "BBI",
  "BRE",
  "CLI",
  "COU",
  "EDM",
  "FAU",
  "FRH",
  "KIN",
  "LOP",
  "MUK",
  "ORI",
  "P52",
  "POT",
  "PTD",
  "SHI",
  "SID",
  "SOU",
  "TAH",
  "VAI",
]);

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Main pipeline function that loads, validates, filters, and creates training data
 * Orchestrates the entire data preparation process for terminal-pair ML training
 */
// ============================================================================
// MAIN EXPORTED FUNCTIONS
// ============================================================================

export const loadAndFilterTrips = async (
  ctx: ActionCtx
): Promise<TerminalPairTrainingData[]> => {
  console.log("Starting data loading pipeline...");

  // Step 1: Load Convex vessel trips from database
  const convexTrips = await loadTrips(ctx);
  console.log(`Loaded ${convexTrips.length} trips from database`);

  // Trips are already in domain format from loadTrips

  // Step 3: Apply data quality filters
  const qualityTrips = applyDataQualityFilters(convexTrips);
  console.log(`After quality filters: ${qualityTrips.length} trips`);

  // Step 4: Group by terminal pairs and create training data
  const trainingData = createTerminalPairTrainingData(qualityTrips);
  console.log(
    `Created training data for ${trainingData.length} terminal pairs`
  );

  return trainingData;
};

// ============================================================================
// TERMINAL PAIR SPECIFIC FUNCTIONS
// ============================================================================

/**
 * Loads trips for a specific terminal pair
 */
export const loadTripsForTerminalPair = async (
  ctx: ActionCtx,
  terminalPair: TerminalPair
): Promise<VesselTrip[]> => {
  const allTrips = await ctx.runQuery(
    api.functions.vesselTrips.queries.getCompletedTrips
  );

  // Convert to domain format first
  const domainTrips = allTrips.map(toDomainVesselTrip);

  // Filter for this specific terminal pair and apply quality checks
  return domainTrips
    .filter(
      (trip) =>
        trip.DepartingTerminalAbbrev === terminalPair.departingTerminalAbbrev &&
        trip.ArrivingTerminalAbbrev === terminalPair.arrivingTerminalAbbrev
    )
    .filter((trip) => {
      // Apply the same quality filters
      if (!isValidBasicTrip(trip)) return false;
      if (!isSaneTrip(trip)) return false;
      if (isOutlierTrip(trip)) return false;
      return true;
    });
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
    VALID_PASSENGER_TERMINALS.has(trip.DepartingTerminalAbbrev) &&
    VALID_PASSENGER_TERMINALS.has(trip.ArrivingTerminalAbbrev)
  );
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Loads vessel trips from the Convex database
 * Query is limited to 5000 trips to avoid Convex response size limits
 */
const loadTrips = async (ctx: ActionCtx): Promise<VesselTrip[]> => {
  const convexTrips = await ctx.runQuery(
    api.functions.vesselTrips.queries.getCompletedTrips
  );
  return convexTrips.map(toDomainVesselTrip);
};

/**
 * Applies comprehensive data quality filters
 */
const applyDataQualityFilters = (trips: VesselTrip[]): VesselTrip[] => {
  return trips.filter((trip) => {
    // Basic null checks
    if (
      !trip.ArrivingTerminalAbbrev ||
      !trip.DepartingTerminalAbbrev ||
      !trip.ScheduledDeparture ||
      !trip.LeftDock
    ) {
      console.log(
        `Skipping trip due to null fields: ${trip.DepartingTerminalAbbrev} -> ${trip.ArrivingTerminalAbbrev}\n${JSON.stringify(trip)}`
      );
      return false;
    }

    // Valid terminal check
    if (
      !VALID_PASSENGER_TERMINALS.has(trip.DepartingTerminalAbbrev) ||
      !VALID_PASSENGER_TERMINALS.has(trip.ArrivingTerminalAbbrev)
    ) {
      console.log(
        `Skipping trip with invalid terminals: ${trip.DepartingTerminalAbbrev} -> ${trip.ArrivingTerminalAbbrev}\n${JSON.stringify(trip)}`
      );
      return false;
    }

    // Sanity checks
    if (!isSaneTrip(trip)) {
      console.log(
        `Skipping insane trip: ${trip.DepartingTerminalAbbrev} -> ${trip.ArrivingTerminalAbbrev}\n${JSON.stringify(trip)}`
      );
      return false;
    }

    // Outlier checks
    if (isOutlierTrip(trip)) {
      console.log(
        `Skipping outlier trip: ${trip.DepartingTerminalAbbrev} -> ${trip.ArrivingTerminalAbbrev}\n${JSON.stringify(trip)}`
      );
      return false;
    }

    return true;
  });
};

/**
 * Validates basic trip sanity (arrival before departure, reasonable times)
 */
const isSaneTrip = (trip: VesselTrip): boolean => {
  // Arrival must be before departure
  if (trip.TripStart && trip.LeftDock && trip.TripStart >= trip.LeftDock) {
    console.log(
      `Arrival after departure: ${trip.TripStart} >= ${trip.LeftDock}`
    );
    return false;
  }

  // Scheduled departure should be reasonable
  if (
    trip.ScheduledDeparture &&
    trip.TripStart &&
    trip.ScheduledDeparture < trip.TripStart
  ) {
    // Allow up to 20 minutes ahead, but not more
    const minutesAhead =
      (trip.TripStart.getTime() - trip.ScheduledDeparture.getTime()) /
      (1000 * 60);
    if (minutesAhead > 20) {
      console.log(`Too far ahead of schedule: ${minutesAhead} minutes`);
      return false;
    }
  }

  return true;
};

/**
 * Identifies outlier trips that should be excluded from training
 */
const isOutlierTrip = (trip: VesselTrip): boolean => {
  // Calculate durations
  const atDockDuration = trip.AtDockDuration;
  const delay = trip.Delay;

  // Outlier checks
  if (delay && delay > 60) return true; // > 1 hour delay
  if (atDockDuration && (atDockDuration < 0 || atDockDuration > 8 * 60))
    return true; // Negative or > 8 hours
  if (trip.AtSeaDuration && trip.AtSeaDuration < 5) return true; // < 5 minutes at sea

  return false;
};

/**
 * Groups trips by terminal pairs and creates training data for each pair
 */
const createTerminalPairTrainingData = (
  trips: VesselTrip[]
): TerminalPairTrainingData[] => {
  // Group trips by terminal pair
  const terminalPairGroups = new Map<string, VesselTrip[]>();

  trips.forEach((trip) => {
    const pairKey = `${trip.DepartingTerminalAbbrev}_${trip.ArrivingTerminalAbbrev}`;
    const group = terminalPairGroups.get(pairKey) || [];
    group.push(trip);
    terminalPairGroups.set(pairKey, group);
  });

  // Create training data for pairs with sufficient data
  const trainingData: TerminalPairTrainingData[] = [];

  terminalPairGroups.forEach((tripsInPair, pairKey) => {
    // Calculate date range for this terminal pair
    const timestamps = tripsInPair
      .map((trip) => trip.TimeStamp.getTime())
      .filter((time) => !Number.isNaN(time));

    const startDate =
      timestamps.length > 0 ? new Date(Math.min(...timestamps)) : null;
    const endDate =
      timestamps.length > 0 ? new Date(Math.max(...timestamps)) : null;

    // Skip pairs with insufficient data
    if (tripsInPair.length < 25) {
      console.log(
        `Skipping terminal pair ${pairKey}: only ${tripsInPair.length} trips`
      );
      return;
    }

    // Log terminal pair statistics
    console.log(
      `Terminal pair ${pairKey}: ${tripsInPair.length} trips from ${startDate?.toISOString().split("T")[0] || "unknown"} to ${endDate?.toISOString().split("T")[0] || "unknown"}`
    );

    const [departingAbbrev, arrivingAbbrev] = pairKey.split("_");
    const terminalPair: TerminalPair = {
      departingTerminalAbbrev: departingAbbrev,
      arrivingTerminalAbbrev: arrivingAbbrev,
    };

    // Create departure model training data (predict at_dock_duration)
    const departureExamples = createDepartureTrainingExamples(tripsInPair);
    if (departureExamples.length >= 25) {
      trainingData.push({
        terminalPair,
        modelType: "departure",
        examples: departureExamples,
      });
    }

    // Create arrival model training data (predict at_sea_duration)
    const arrivalExamples = createArrivalTrainingExamples(tripsInPair);
    if (arrivalExamples.length >= 25) {
      trainingData.push({
        terminalPair,
        modelType: "arrival",
        examples: arrivalExamples,
      });
    }
  });

  return trainingData;
};

/**
 * Creates training examples for departure model (predict at_dock_duration)
 */
const createDepartureTrainingExamples = (
  trips: VesselTrip[]
): TrainingExample[] => {
  return trips
    .filter(
      (trip) =>
        trip.AtDockDuration != null &&
        trip.TripStart &&
        trip.ScheduledDeparture &&
        trip.Delay != null
    )
    .map((trip) => ({
      input: extractDepartureFeatures(trip),
      target: trip.AtDockDuration!,
    }));
};

/**
 * Creates training examples for arrival model (predict at_sea_duration)
 */
const createArrivalTrainingExamples = (
  trips: VesselTrip[]
): TrainingExample[] => {
  return trips
    .filter(
      (trip) =>
        trip.AtSeaDuration != null &&
        trip.LeftDock &&
        trip.ScheduledDeparture &&
        trip.Delay != null
    )
    .map((trip) => ({
      input: extractArrivalFeatures(trip),
      target: trip.AtSeaDuration!,
    }));
};

/**
 * Extracts features for departure model
 * IMPORTANT: Only use features available at the time of vessel arrival
 * DO NOT use delay_minutes as it creates data leakage (calculated from actual departure)
 */
const extractDepartureFeatures = (trip: VesselTrip) => {
  const scheduleDelta = calculateScheduleDelta(trip);
  const scheduleDeltaClamped = Math.min(20, Math.max(-Infinity, scheduleDelta));
  const hourOfDay = trip.TripStart!.getHours();
  const isWeekend =
    trip.TripStart!.getDay() === 0 || trip.TripStart!.getDay() === 6;

  return {
    schedule_delta_clamped: scheduleDeltaClamped,
    hour_of_day: hourOfDay,
    is_weekend: isWeekend ? 1 : 0,
    // Removed delay_minutes to prevent data leakage - it's calculated from actual departure time
  };
};

/**
 * Extracts features for arrival model
 */
const extractArrivalFeatures = (trip: VesselTrip) => {
  const scheduleDelta = calculateScheduleDelta(trip);
  const scheduleDeltaClamped = Math.min(20, Math.max(-Infinity, scheduleDelta));
  const hourOfDay = trip.LeftDock!.getHours();
  const isWeekend =
    trip.LeftDock!.getDay() === 0 || trip.LeftDock!.getDay() === 6;

  return {
    schedule_delta_clamped: scheduleDeltaClamped,
    hour_of_day: hourOfDay,
    is_weekend: isWeekend ? 1 : 0,
    delay_minutes: trip.Delay || 0,
  };
};

/**
 * Calculates schedule delta in minutes (positive = ahead of schedule)
 */
const calculateScheduleDelta = (trip: VesselTrip): number => {
  if (!trip.TripStart || !trip.ScheduledDeparture) {
    throw new Error(
      `Missing TripStart or ScheduledDeparture for trip calculation`
    );
  }
  const arrivalTime = trip.TripStart.getTime();
  const scheduledTime = trip.ScheduledDeparture.getTime();
  return (scheduledTime - arrivalTime) / (1000 * 60); // Convert to minutes
};
