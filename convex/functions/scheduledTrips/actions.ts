import { api } from "_generated/api";
import { type ActionCtx, action, internalAction } from "_generated/server";
import { ConvexError } from "convex/values";
import type { Route, Schedule, TerminalCombo } from "ws-dottie/wsf-schedule";
import {
  fetchRoutesByTripDate,
  fetchScheduleByTripDateAndRouteId,
} from "ws-dottie/wsf-schedule";
import {
  type ConvexScheduledTrip,
  generateScheduledTripKey,
  getTerminalAbbreviation,
  getVesselAbbreviation,
} from "./schemas";

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
 * Simple retry utility for external API calls
 */
const retryOnce = async <T>(fn: () => Promise<T>): Promise<T> => {
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
  route: Route
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
  const key = generateScheduledTripKey(
    vesselAbbrev,
    departingTerminalAbbrev,
    arrivingTerminalAbbrev,
    time.DepartingTime
  );

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
  };

  return trip;
};

/**
 * Flatten schedule data into individual scheduled trip records
 */
const flattenScheduleToTrips = (
  schedule: Schedule,
  route: Route
): ConvexScheduledTrip[] =>
  schedule.TerminalCombos.flatMap((terminalCombo) =>
    (terminalCombo.Times as Time[])
      .map((time) => buildTripIntermediateData(time, terminalCombo))
      .filter(isValidTripData)
      .map((tripData) => createScheduledTrip(tripData, route))
  );

/**
 * Shared logic for syncing scheduled trips data
 * Used by both internal and manual actions
 */
const performScheduledTripsSync = async (
  ctx: ActionCtx,
  logPrefix: string = ""
): Promise<void> => {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format

  try {
    console.log(`${logPrefix}Starting scheduled trips sync for ${today}`);

    // Step 1: Fetch routes for today
    console.log(`${logPrefix}Fetching routes for ${today}`);
    const routes: Route[] = await retryOnce(() =>
      fetchRoutesByTripDate({ params: { TripDate: today } })
    );
    console.log(`${logPrefix}Found ${routes.length} routes for ${today}`);

    // Step 2: Fetch schedules for each route (continue on individual failures)
    const routeSchedules: Array<{ route: Route; schedule: Schedule }> = [];

    for (const route of routes) {
      try {
        console.log(
          `${logPrefix}Fetching schedule for route ${route.RouteID} (${route.RouteAbbrev || "no abbrev"})`
        );
        const schedule = await retryOnce(() =>
          fetchScheduleByTripDateAndRouteId({
            params: {
              TripDate: today,
              RouteID: route.RouteID,
            },
          })
        );
        routeSchedules.push({ route, schedule });
      } catch (error) {
        console.error(
          `${logPrefix}Failed to fetch schedule for route ${route.RouteID}, skipping:`,
          error
        );
        // Continue with other routes instead of failing completely
      }
    }

    console.log(
      `${logPrefix}Successfully fetched ${routeSchedules.length}/${routes.length} route schedules`
    );

    if (routeSchedules.length === 0) {
      throw new ConvexError({
        message: `No route schedules could be fetched for ${today}`,
        code: "NO_SCHEDULES_FETCHED",
        severity: "error",
      });
    }

    // Step 3: Flatten all schedules into individual trip records
    const allTrips: ConvexScheduledTrip[] = routeSchedules
      .map(({ route, schedule }) => {
        const trips = flattenScheduleToTrips(schedule, route);
        console.log(
          `${logPrefix}Flattened ${trips.length} trips from route ${route.RouteID}`
        );
        return trips;
      })
      .reduce((acc, trips) => acc.concat(trips), []);

    console.log(`${logPrefix}Total trips to upsert: ${allTrips.length}`);

    // Step 4: Bulk upsert all trips
    const upsertResults: string[] = await ctx.runMutation(
      api.functions.scheduledTrips.mutations.upsertScheduledTrips,
      { trips: allTrips }
    );

    console.log(
      `${logPrefix}Successfully upserted ${upsertResults.length} scheduled trips`
    );
  } catch (error) {
    console.error(
      `${logPrefix}Scheduled trips sync failed for ${today}:`,
      error
    );
    throw new ConvexError({
      message: `Scheduled trips sync failed for ${today}`,
      code: "SYNC_SCHEDULED_TRIPS_FAILED",
      severity: "error",
      details: { error: String(error) },
    });
  }
};

/**
 * Internal action for syncing scheduled trips data
 * This will eventually be called by a cron job
 */
/**
 * Internal action for syncing scheduled trips data
 * This will eventually be called by a cron job
 *
 * @returns Sync result with statistics
 */
export const syncScheduledTrips = internalAction({
  args: {},
  handler: async (ctx: ActionCtx) => performScheduledTripsSync(ctx),
});

/**
 * Manual trigger for testing scheduled trips sync
 * Uses shared sync logic to avoid code duplication
 */
export const syncScheduledTripsManual = action({
  args: {},
  handler: async (ctx) => performScheduledTripsSync(ctx, "[MANUAL] "),
});
