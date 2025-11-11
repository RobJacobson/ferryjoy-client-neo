import type { ActiveVesselTrip } from "src/domain";
import { fromConvexCompletedVesselTrip } from "src/domain/vessels/completedVesselTrip";
import { api } from "../../../_generated/api";
import type { ActionCtx } from "../../../_generated/server";
import type { TripPair, ValidatedTrip } from "../types";

// import { fromConvexCompletedVesselTrip } from "../../functions/completedVesselTrips/schemas";

// ============================================================================
// MAIN FUNCTION
// ============================================================================

/**
 * Main pipeline function that loads, validates, filters, and creates training pairs
 * Orchestrates the entire data preparation process for ML training
 */
export const loadAndFilterTrips = async (
  ctx: ActionCtx
): Promise<TripPair[]> => {
  // Step 1: Load Convex vessel trips from database
  const convexTrips = await loadTrips(ctx);

  // Step 2: Convert Convex format to domain format and filter valid trips
  const validTrips = toValidTrips(convexTrips);

  // Step 3: Filter out outliers in the trips
  const filteredTrips = toSanitizedTrips(validTrips);

  // Step 4: Sort trips by vessel name and scheduled departure
  const sortedTrips = toSortedByVesselAndSchedDeparture(filteredTrips);

  // Step 5: Create trip pairs from sorted trips
  const pairs = toTripPairsFromSorted(sortedTrips);

  console.log(`Created ${pairs.length} trip pairs`);
  return pairs;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Step 1: Loads vessel trips from the Convex database
 * Fetches all completed vessel trips for ML training
 */
const loadTrips = async (ctx: ActionCtx): Promise<ActiveVesselTrip[]> => {
  const convexTrips = await ctx.runQuery(
    api.functions.completedVesselTrips.queries.getCompletedTrips
  );
  return convexTrips.map(fromConvexCompletedVesselTrip);
};

/**
 * Step 2: Converts Convex vessel trips to domain format and filters for valid trips
 * Maps from Convex timestamp format to domain Date objects and validates required fields
 */
const toValidTrips = (convexTrips: ActiveVesselTrip[]): ValidatedTrip[] =>
  convexTrips.filter(isValidTrip) as ValidatedTrip[];
/**
 * Validates that a vessel trip has all required fields for ML training
 * Ensures all critical fields are present and non-null
 */
const isValidTrip = (trip: ActiveVesselTrip): boolean =>
  !!(
    trip.InService &&
    trip.OpRouteAbbrev &&
    trip.ArrivingTerminalAbbrev &&
    trip.DepartingTerminalAbbrev &&
    trip.ScheduledDeparture &&
    trip.LeftDock &&
    trip.ScheduledDeparture < trip.LeftDock &&
    trip.Eta
  );

/**
 * Step 3: Applies additional filtering to remove outlier trips
 * Filters out trips with early departures and unreasonable delays
 */
const toSanitizedTrips = (validTrips: ValidatedTrip[]): ValidatedTrip[] =>
  validTrips
    .filter(isNotEarlyDeparture)
    .filter(isNotOutlierDeparture)
    .filter(isNotTripToNowhere);

/**
 * Filters out trips where the vessel left dock before the scheduled departure time
 * This indicates data quality issues or incorrect timestamps
 */
const isNotEarlyDeparture = (trip: ValidatedTrip): boolean =>
  trip.LeftDock > trip.ScheduledDeparture;

/**
 * Filters out trips with unreasonable delays (more than 30 minutes)
 * Helps remove outliers that could skew the ML model training
 */
const isNotOutlierDeparture = (trip: ValidatedTrip): boolean =>
  trip.LeftDock.getTime() <= trip.ScheduledDeparture.getTime() + 30 * 60 * 1000;

/**
 * Filters out trips where the arriving terminal is the same as the departing terminal
 * This indicates a trip to nowhere
 */
const isNotTripToNowhere = (trip: ValidatedTrip): boolean =>
  trip.ArrivingTerminalAbbrev !== null &&
  trip.ArrivingTerminalAbbrev !== trip.DepartingTerminalAbbrev;

/**
 * Step 4: Groups valid vessel trips by vessel name and sorts each vessel's trips by departure time
 * Creates a record where each key is a vessel name and value is an array of that vessel's trips sorted by scheduled departure
 */
const toSortedByVesselAndSchedDeparture = (
  validTrips: ValidatedTrip[]
): ValidatedTrip[] =>
  [...validTrips].sort((a, b) =>
    a.VesselName === b.VesselName
      ? a.ScheduledDeparture.getTime() - b.ScheduledDeparture.getTime()
      : a.VesselName < b.VesselName
        ? -1
        : 1
  );

/**
 * Step 5: Creates trip pairs from sorted vessel trips
 * Creates training pairs by comparing consecutive trips for the same vessel
 */
const toTripPairsFromSorted = (sortedTrips: ValidatedTrip[]): TripPair[] =>
  sortedTrips
    .slice(1)
    .map((currTrip, i) => ({
      prevTrip: sortedTrips[i],
      currTrip,
      routeId: currTrip.OpRouteAbbrev,
    }))
    .filter(
      ({ prevTrip, currTrip }) =>
        prevTrip.VesselName === currTrip.VesselName &&
        prevTrip.DepartingTerminalAbbrev === currTrip.ArrivingTerminalAbbrev
    );
