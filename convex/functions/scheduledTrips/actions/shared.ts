import { generateTripKey } from "shared";
import type { Route, Schedule, TerminalCombo } from "ws-dottie/wsf-schedule";
import { fetchScheduleByTripDateAndRouteId } from "ws-dottie/wsf-schedule";
import type { ConvexScheduledTrip } from "../schemas";
import { getTerminalAbbreviation, getVesselAbbreviation } from "../schemas";
import type {
  ScheduledTripDoc,
  TripIntermediateData,
  VesselSailing,
} from "./types";

/**
 * Configuration constants for scheduled trips operations.
 * Centralized configuration to avoid magic numbers and enable easy maintenance.
 */
const CONFIG = {
  /** Delay in milliseconds before retrying failed external API calls */
  RETRY_DELAY_MS: 5000,
} as const;

/**
 * Creates a complete scheduled trip record directly from WSF API data.
 * Generates the composite key and resolves all abbreviations in one step.
 *
 * @param vesselSailing - Raw vessel sailing data from WSF API
 * @param terminalCombo - Terminal combination with route details
 * @param route - Route information from WSF API
 * @param tripDate - Trip date in YYYY-MM-DD format
 * @returns Complete scheduled trip record ready for Convex storage, or null if invalid
 */
const createScheduledTrip = (
  vesselSailing: VesselSailing,
  terminalCombo: TerminalCombo,
  route: Route,
  tripDate: string
): ConvexScheduledTrip | null => {
  // Extract annotations by mapping indexes to the terminal combo's annotation array
  const annotations = vesselSailing.AnnotationIndexes
    ? vesselSailing.AnnotationIndexes.filter(
        (index) => index < terminalCombo.Annotations.length
      ).map((index) => terminalCombo.Annotations[index])
    : [];

  // Resolve full names to standard WSF abbreviations
  const vesselAbbrev = getVesselAbbreviation(vesselSailing.VesselName);
  const departingTerminalAbbrev = getTerminalAbbreviation(
    terminalCombo.DepartingTerminalName
  );
  const arrivingTerminalAbbrev = getTerminalAbbreviation(
    terminalCombo.ArrivingTerminalName
  );

  // Reject trips with missing abbreviations to maintain data integrity
  if (!vesselAbbrev || !departingTerminalAbbrev || !arrivingTerminalAbbrev) {
    console.warn(`Skipping trip due to missing abbreviations:`, {
      vessel: vesselSailing.VesselName,
      departing: terminalCombo.DepartingTerminalName,
      arriving: terminalCombo.ArrivingTerminalName,
    });
    return null;
  }

  // Generate the composite key that uniquely identifies this trip
  const key = generateTripKey(
    vesselAbbrev,
    departingTerminalAbbrev,
    arrivingTerminalAbbrev,
    vesselSailing.DepartingTime
  );

  if (!key) {
    throw new Error(
      `Failed to generate key for scheduled trip: ${vesselAbbrev}-${departingTerminalAbbrev}-${arrivingTerminalAbbrev}`
    );
  }

  const trip: ConvexScheduledTrip = {
    VesselAbbrev: vesselAbbrev,
    DepartingTerminalAbbrev: departingTerminalAbbrev,
    ArrivingTerminalAbbrev: arrivingTerminalAbbrev,
    DepartingTime: vesselSailing.DepartingTime.getTime(),
    ArrivingTime: vesselSailing.ArrivingTime
      ? vesselSailing.ArrivingTime.getTime()
      : undefined,
    SailingNotes: terminalCombo.SailingNotes,
    Annotations: annotations,
    RouteID: route.RouteID,
    RouteAbbrev: route.RouteAbbrev || "",
    Key: key,
    SailingDay: tripDate,
  };

  return trip;
};

/**
 * Filters out indirect/overlapping trips using a two-pointer chronological scan.
 * For multi-stage vessel trips, WSF API reports multiple destination options from the same
 * departure point. This function scans chronologically and uses lookahead to identify
 * which destination matches the vessel's actual next departure terminal.
 *
 * Algorithm:
 * 1. Group trips by vessel and sailing day, sort chronologically
 * 2. Scan through trips with two pointers (current + lookahead)
 * 3. When overlapping departures found, check next trip's departure terminal
 * 4. Keep only trips where arrival terminal matches next departure terminal
 *
 * @param trips - Array of scheduled trip records to filter
 * @returns Filtered array with chronologically correct trips only
 */
export const filterOverlappingTrips = (
  trips: ConvexScheduledTrip[]
): ConvexScheduledTrip[] => {
  // Group trips by vessel and sailing day
  const tripsByVesselAndDay = new Map<string, ConvexScheduledTrip[]>();

  for (const trip of trips) {
    const key = `${trip.VesselAbbrev}-${trip.SailingDay}`;
    const vesselTrips = tripsByVesselAndDay.get(key);
    if (vesselTrips) {
      vesselTrips.push(trip);
    } else {
      tripsByVesselAndDay.set(key, [trip]);
    }
  }

  const filteredTrips: ConvexScheduledTrip[] = [];

  // Process each vessel-day group
  for (const [, vesselTrips] of tripsByVesselAndDay) {
    if (vesselTrips.length === 0) continue;

    // Sort chronologically by departure time
    vesselTrips.sort((a, b) => a.DepartingTime - b.DepartingTime);

    let i = 0;
    while (i < vesselTrips.length) {
      // Find all trips with same departure time and terminal (overlapping group)
      const currentTrip = vesselTrips[i];
      const overlappingTrips: ConvexScheduledTrip[] = [];

      // Collect all trips with same departure time and terminal
      while (
        i < vesselTrips.length &&
        vesselTrips[i].DepartingTime === currentTrip.DepartingTime &&
        vesselTrips[i].DepartingTerminalAbbrev ===
          currentTrip.DepartingTerminalAbbrev
      ) {
        overlappingTrips.push(vesselTrips[i]);
        i++;
      }

      if (overlappingTrips.length === 1) {
        // Single trip - keep it
        filteredTrips.push(overlappingTrips[0]);
      } else {
        // Multiple overlapping trips - find which one matches next departure terminal
        // Look ahead to find where this vessel departs from next
        let nextDepartureTerminal: string | undefined;

        // Scan forward from current position to find next different departure terminal
        for (let j = i; j < vesselTrips.length; j++) {
          const nextTrip = vesselTrips[j];
          // Skip trips with same departure time (part of current overlapping group)
          if (nextTrip.DepartingTime === currentTrip.DepartingTime) continue;

          // Found next departure - this terminal is where vessel goes next
          nextDepartureTerminal = nextTrip.DepartingTerminalAbbrev;
          break;
        }

        if (nextDepartureTerminal) {
          // Keep only the trip that goes to the next departure terminal
          const correctTrip = overlappingTrips.find(
            (trip) => trip.ArrivingTerminalAbbrev === nextDepartureTerminal
          );

          if (correctTrip) {
            filteredTrips.push(correctTrip);
          } else {
            // Fallback: no trip matches expected next terminal
            // This can happen with irregular schedules - keep all options
            console.warn(
              `No overlapping trip goes to expected next terminal ${nextDepartureTerminal} ` +
                `for vessel ${currentTrip.VesselAbbrev} departing ${currentTrip.DepartingTerminalAbbrev} ` +
                `at ${new Date(currentTrip.DepartingTime).toISOString()}`
            );
            filteredTrips.push(...overlappingTrips);
          }
        } else {
          // No next departure found (end of vessel's schedule) - keep all options
          filteredTrips.push(...overlappingTrips);
        }
      }
    }
  }

  return filteredTrips;
};

/**
 * Flattens complete WSF schedule data into individual scheduled trip records.
 * Converts WSF API responses into structured trip data ready for database storage.
 *
 * @param schedule - Complete schedule data from WSF API for one route and date
 * @param route - Route metadata (ID, abbreviation) from WSF API
 * @param tripDate - Trip date in YYYY-MM-DD format (becomes SailingDay in stored data)
 * @returns Array of scheduled trip records ready for Convex database insertion
 */
export const flattenScheduleToTrips = (
  schedule: Schedule,
  route: Route,
  tripDate: string
): ConvexScheduledTrip[] => {
  return schedule.TerminalCombos.flatMap((terminalCombo) =>
    (terminalCombo.Times as VesselSailing[])
      .map((vesselSailing) =>
        createScheduledTrip(vesselSailing, terminalCombo, route, tripDate)
      )
      .filter((trip): trip is ConvexScheduledTrip => trip !== null)
  );
};

/**
 * Simple retry utility for external API calls with exponential backoff.
 * Implements a single retry with fixed delay to handle transient network issues.
 * Used for all WSF API calls to improve reliability.
 *
 * @param fn - Async function to retry on failure
 * @returns Result of the function call (either first attempt or retry)
 * @throws Last error encountered if both attempts fail
 */
export const retryOnce = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    console.warn("API call failed, retrying once:", error);
    // Fixed delay retry - simple and predictable for external API calls
    await new Promise((resolve) => setTimeout(resolve, CONFIG.RETRY_DELAY_MS));
    return await fn();
  }
};

/**
 * Fetches detailed schedule data for a specific route and trip date from WSF API.
 * Retrieves all terminal combinations, times, and annotations for the given route.
 * This is the core data source for scheduled trip information.
 *
 * @param routeId - WSF route identifier (e.g., 1 for Seattle-Bainbridge)
 * @param tripDate - Trip date in YYYY-MM-DD format (WSF operational day)
 * @returns Complete schedule data including terminal combinations and vessel times
 * @throws Error if WSF API call fails after retry attempts
 */
export const fetchRouteSchedule = async (
  routeId: number,
  tripDate: string
): Promise<Schedule> => {
  return await retryOnce(() =>
    fetchScheduleByTripDateAndRouteId({
      params: {
        TripDate: tripDate,
        RouteID: routeId,
      },
    })
  );
};

/**
 * Compares two scheduled trip records for equality to determine if an update is needed.
 * Used during sync operations to avoid unnecessary database updates.
 * Performs deep comparison of all business-relevant fields.
 *
 * Note: Excludes Convex metadata fields (_id, _creationTime) from comparison
 * as these are not part of the business data.
 *
 * @param a - Existing trip document from database (with metadata)
 * @param b - New trip data from WSF API (without metadata)
 * @returns true if trips are functionally identical, false if any field differs
 */
export function tripsEqual(
  a: ScheduledTripDoc,
  b: ConvexScheduledTrip
): boolean {
  // Compare all business-relevant fields for exact equality
  // Order matters for performance - check simple fields first
  return (
    a.Key === b.Key &&
    a.VesselAbbrev === b.VesselAbbrev &&
    a.DepartingTerminalAbbrev === b.DepartingTerminalAbbrev &&
    a.ArrivingTerminalAbbrev === b.ArrivingTerminalAbbrev &&
    a.DepartingTime === b.DepartingTime &&
    a.ArrivingTime === b.ArrivingTime &&
    a.SailingNotes === b.SailingNotes &&
    // Deep comparison for arrays - convert to JSON for reliable equality
    JSON.stringify(a.Annotations) === JSON.stringify(b.Annotations) &&
    a.RouteID === b.RouteID &&
    a.RouteAbbrev === b.RouteAbbrev &&
    a.SailingDay === b.SailingDay
  );
}
