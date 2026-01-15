import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { generateTripKey } from "shared";
import type { Route, Schedule, TerminalCombo } from "ws-dottie/wsf-schedule";
import { fetchScheduleByTripDateAndRouteId } from "ws-dottie/wsf-schedule";
import type { ConvexScheduledTrip } from "../schemas";
import { getTerminalAbbreviation, getVesselAbbreviation } from "../schemas";
import type { RouteSyncResult, ScheduledTripDoc } from "./types";

/**
 * Type for individual time entries in terminal combinations
 */
type Time = {
  DepartingTime: Date;
  ArrivingTime: Date | null;
  LoadingRule: 1 | 2 | 3;
  VesselID: number;
  VesselName: string;
  VesselHandicapAccessible: boolean;
  VesselPositionNum: number;
  Routes: number[];
  AnnotationIndexes: number[] | null;
};

/**
 * Intermediate data structure for building scheduled trips
 */
type TripIntermediateData = {
  vesselAbbrev: string;
  departingTerminalAbbrev: string;
  arrivingTerminalAbbrev: string;
  time: Time;
  annotations: string[];
  terminalCombo: TerminalCombo;
};

/**
 * Build intermediate trip data with abbreviations and annotations
 */
const buildTripIntermediateData = (
  time: Time,
  terminalCombo: TerminalCombo
): TripIntermediateData => {
  // Build annotations from parent annotations using annotation indexes
  const annotations = time.AnnotationIndexes
    ? time.AnnotationIndexes.filter(
        (index) => index < terminalCombo.Annotations.length
      ).map((index) => terminalCombo.Annotations[index])
    : [];

  // Convert names to abbreviations
  const vesselAbbrev = getVesselAbbreviation(time.VesselName);
  const departingTerminalAbbrev = getTerminalAbbreviation(
    terminalCombo.DepartingTerminalName
  );
  const arrivingTerminalAbbrev = getTerminalAbbreviation(
    terminalCombo.ArrivingTerminalName
  );

  return {
    vesselAbbrev,
    departingTerminalAbbrev,
    arrivingTerminalAbbrev,
    time,
    annotations,
    terminalCombo,
  };
};

/**
 * Validate that trip data has all required abbreviations
 */
const isValidTripData = (tripData: TripIntermediateData): boolean => {
  const {
    vesselAbbrev,
    departingTerminalAbbrev,
    arrivingTerminalAbbrev,
    time,
    terminalCombo,
  } = tripData;

  // Skip if we can't determine abbreviations (defensive programming)
  if (!vesselAbbrev || !departingTerminalAbbrev || !arrivingTerminalAbbrev) {
    console.warn(`Skipping trip due to missing abbreviations:`, {
      vessel: time.VesselName,
      departing: terminalCombo.DepartingTerminalName,
      arriving: terminalCombo.ArrivingTerminalName,
    });
    return false;
  }
  return true;
};

/**
 * Create a scheduled trip record from validated intermediate data
 */
const createScheduledTrip = (
  tripData: TripIntermediateData,
  route: Route,
  tripDate: string
): ConvexScheduledTrip => {
  const {
    vesselAbbrev,
    departingTerminalAbbrev,
    arrivingTerminalAbbrev,
    time,
    annotations,
    terminalCombo,
  } = tripData;

  // Generate composite key
  const key = generateTripKey(
    vesselAbbrev,
    departingTerminalAbbrev,
    arrivingTerminalAbbrev,
    time.DepartingTime
  );

  // Scheduled trips should always have a key since they have departure times
  if (!key) {
    throw new Error(
      `Failed to generate key for scheduled trip: ${vesselAbbrev}-${departingTerminalAbbrev}-${arrivingTerminalAbbrev}`
    );
  }

  // Use the trip date from the WSF API call as the authoritative sailing day
  const sailingDay = tripDate;

  const trip: ConvexScheduledTrip = {
    VesselAbbrev: vesselAbbrev,
    DepartingTerminalAbbrev: departingTerminalAbbrev,
    ArrivingTerminalAbbrev: arrivingTerminalAbbrev,
    DepartingTime: time.DepartingTime.getTime(),
    ArrivingTime: time.ArrivingTime ? time.ArrivingTime.getTime() : undefined,
    SailingNotes: terminalCombo.SailingNotes,
    Annotations: annotations,
    RouteID: route.RouteID,
    RouteAbbrev: route.RouteAbbrev || "",
    Key: key,
    SailingDay: sailingDay,
  };

  return trip;
};

/**
 * Flatten schedule data into individual scheduled trip records
 * @param schedule - WSF schedule data
 * @param route - Route information
 * @param tripDate - The trip date used for the WSF API call (authoritative sailing day)
 */
export const flattenScheduleToTrips = (
  schedule: Schedule,
  route: Route,
  tripDate: string
): ConvexScheduledTrip[] =>
  schedule.TerminalCombos.flatMap((terminalCombo) =>
    (terminalCombo.Times as Time[])
      .map((time) => buildTripIntermediateData(time, terminalCombo))
      .filter(isValidTripData)
      .map((tripData) => createScheduledTrip(tripData, route, tripDate))
  );

/**
 * Simple retry utility for external API calls
 */
export const retryOnce = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    console.warn("API call failed, retrying once:", error);
    // Wait 2 seconds then retry once
    await new Promise((resolve) => setTimeout(resolve, 5000));
    return await fn();
  }
};

/**
 * Fetches schedule data for a specific route from WSF API
 * @param routeId - Route ID to fetch
 * @param dateString - Date in YYYY-MM-DD format
 * @returns Schedule data from WSF API
 */
export const fetchRouteSchedule = async (
  routeId: number,
  dateString: string
): Promise<Schedule> => {
  return await retryOnce(() =>
    fetchScheduleByTripDateAndRouteId({
      params: {
        TripDate: dateString,
        RouteID: routeId,
      },
    })
  );
};

/**
 * Utility function to compare trips for equality
 * Used to determine if an update is needed
 * Excludes _id and _creationTime fields from comparison
 */
export function tripsEqual(
  a: ScheduledTripDoc,
  b: ConvexScheduledTrip
): boolean {
  // Compare all fields except _id and _creationTime
  return (
    a.Key === b.Key &&
    a.VesselAbbrev === b.VesselAbbrev &&
    a.DepartingTerminalAbbrev === b.DepartingTerminalAbbrev &&
    a.ArrivingTerminalAbbrev === b.ArrivingTerminalAbbrev &&
    a.DepartingTime === b.DepartingTime &&
    a.ArrivingTime === b.ArrivingTime &&
    a.SailingNotes === b.SailingNotes &&
    JSON.stringify(a.Annotations) === JSON.stringify(b.Annotations) &&
    a.RouteID === b.RouteID &&
    a.RouteAbbrev === b.RouteAbbrev &&
    a.SailingDay === b.SailingDay
  );
}

/**
 * Syncs a single route by fetching its schedule and updating the database atomically
 * @param ctx - Convex action context
 * @param route - Route to sync
 * @param today - Date string in YYYY-MM-DD format
 * @param logPrefix - Prefix for log messages
 * @returns Sync result for this route
 */
export const syncRoute = async (
  ctx: ActionCtx,
  route: Route,
  today: string,
  logPrefix: string = ""
): Promise<RouteSyncResult> => {
  console.log(
    `${logPrefix}Syncing route ${route.RouteID} (${route.RouteAbbrev || "no abbrev"})`
  );

  // Fetch schedule for this route
  const schedule = await fetchRouteSchedule(route.RouteID, today);

  // Flatten schedule to trips using the authoritative trip date
  const routeTrips = flattenScheduleToTrips(schedule, route, today);
  console.log(
    `${logPrefix}Flattened ${routeTrips.length} trips from route ${route.RouteID}`
  );

  // Sync this route atomically
  const results = await ctx.runMutation(
    api.functions.scheduledTrips.mutations.syncScheduledTripsForRoute,
    {
      routeId: route.RouteID,
      trips: routeTrips,
    }
  );

  console.log(
    `${logPrefix}Route ${route.RouteID} sync: +${results.inserted} -${results.deleted} ~${results.updated} changes`
  );

  return {
    routeId: route.RouteID,
    routeAbbrev: route.RouteAbbrev || "",
    results,
  };
};
