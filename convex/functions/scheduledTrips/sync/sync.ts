import type { ActionCtx } from "_generated/server";
import type { Route } from "ws-dottie/wsf-schedule";
import { formatPacificDate } from "../../../shared/keys";
import type { ConvexScheduledTrip } from "../schemas";
import {
  calculateTripEstimates,
  filterOverlappingTrips,
} from "./businessLogic";
import { createScheduledTrip } from "./dataTransformation";
import { fetchActiveRoutes, fetchRouteSchedule } from "./infrastructure";
import { performSafeDataReplacement } from "./persistence";
import type { DaySyncResult, VesselSailing } from "./types";

const logPrefix = "[SYNC TRIPS]";

/**
 * Syncs scheduled trips for a range of consecutive days.
 * Simply calls syncScheduledTripsForDate for each day in the range.
 *
 * @param ctx - Convex action context
 * @param startDate - Start date in YYYY-MM-DD format
 * @param daysToSync - Number of consecutive days to sync
 * @returns Summary of all sync operations
 */
export const syncScheduledTripsForDateRange = async (
  ctx: ActionCtx,
  startDate: string,
  daysToSync: number
): Promise<{
  totalDeleted: number;
  totalInserted: number;
  totalFiltered: number;
  daysProcessed: DaySyncResult[];
}> => {
  const results: DaySyncResult[] = [];
  let totalDeleted = 0;
  let totalInserted = 0;
  let totalFiltered = 0;

  console.log(
    `${logPrefix} Starting range sync: ${daysToSync} days starting ${startDate}`
  );

  for (let i = 0; i < daysToSync; i++) {
    const currentDate = addDays(startDate, i);

    try {
      const result = await syncScheduledTripsForDate(ctx, currentDate);

      results.push({
        sailingDay: currentDate,
        action: "synced",
      });

      totalDeleted += result.deleted;
      totalInserted += result.inserted;
      totalFiltered += result.totalFiltered;
    } catch (error) {
      console.error(`${logPrefix}Failed to sync ${currentDate}:`, error);
      results.push({
        sailingDay: currentDate,
        action: "failed",
        error: String(error),
      });
    }
  }

  console.log(
    `${logPrefix}Range sync completed: ${results.length} days processed`
  );

  return {
    totalDeleted,
    totalInserted,
    totalFiltered,
    daysProcessed: results,
  };
};

/**
 * Syncs scheduled trips for a single date using the safe download-first approach.
 *
 * Process:
 * 1. Fetch all active routes for the target date
 * 2. Download fresh schedule data for all routes (fail fast if any download fails)
 * 3. Only after successful download, delete all existing trips for the target date
 * 4. Insert all the fresh downloaded data
 *
 * @param ctx - Convex action context for database operations
 * @param targetDate - Target trip date in YYYY-MM-DD format to synchronize
 * @returns Summary of the sync operation
 */
export const syncScheduledTripsForDate = async (
  ctx: ActionCtx,
  targetDate: string
): Promise<{
  deleted: number;
  inserted: number;
  routesProcessed: number;
  totalFiltered: number;
}> => {
  try {
    console.log(`${logPrefix} Starting scheduled trips sync for ${targetDate}`);

    // Phase 1: Fetch all active routes
    console.log(`${logPrefix}Fetching routes for ${targetDate}`);
    const routes: Route[] = await fetchActiveRoutes(targetDate);
    console.log(
      `${logPrefix}Found ${routes.length} routes:`,
      routes
        .map((r) => `${r.RouteID} (${r.RouteAbbrev || "no abbrev"})`)
        .join(", ")
    );

    if (routes.length === 0) {
      console.log(`${logPrefix}No routes found for ${targetDate}`);
      return { deleted: 0, inserted: 0, routesProcessed: 0, totalFiltered: 0 };
    }

    // Phase 2: Download ALL fresh data before making any changes
    const routeData = await downloadRouteData(routes, targetDate);

    // Phase 3: Combine and filter trips
    const { finalTrips, totalFiltered } = combineAndFilterTrips(routeData);

    console.log(
      `${logPrefix}Successfully downloaded ${finalTrips.length} trips across ${routeData.length} routes`
    );

    // Phase 4: Only now that we have all data, perform safe replacement
    const { deleted, inserted } = await performSafeDataReplacement(
      ctx,
      targetDate,
      finalTrips
    );

    console.log(
      `${logPrefix}Safe sync completed: deleted ${deleted}, inserted ${inserted}, filtered ${totalFiltered} trips across ${routeData.length} routes`
    );

    return {
      deleted,
      inserted,
      routesProcessed: routeData.length,
      totalFiltered,
    };
  } catch (error) {
    console.error(
      `${logPrefix}Safe scheduled trips sync failed for ${targetDate}:`,
      error
    );
    throw error;
  }
};

/**
 * Downloads and processes schedule data for all routes on a specific date.
 */
const downloadRouteData = async (
  routes: Route[],
  tripDate: string
): Promise<
  {
    route: Route;
    trips: ConvexScheduledTrip[];
    rawTripCount: number;
  }[]
> => {
  console.log(`${logPrefix} Downloading fresh data for all routes`);

  const routePromises = routes.map(async (route) => {
    console.log(
      `${logPrefix}Downloading route ${route.RouteID} (${route.RouteAbbrev || "no abbrev"})`
    );

    // Fetch schedule data
    const schedule = await fetchRouteSchedule(route.RouteID, tripDate);

    // Convert to trips (raw data only, skip filtering for now)
    const rawTripCount = schedule.TerminalCombos.flatMap(
      (terminalCombo) => (terminalCombo.Times as VesselSailing[]).length
    ).reduce((sum, count) => sum + count, 0);

    const routeTrips = schedule.TerminalCombos.flatMap((terminalCombo) =>
      (terminalCombo.Times as VesselSailing[])
        .map((vesselSailing) =>
          createScheduledTrip(vesselSailing, terminalCombo, route, tripDate)
        )
        .filter((trip): trip is ConvexScheduledTrip => trip !== null)
    );

    console.log(
      `${logPrefix}Route ${route.RouteID} downloaded ${routeTrips.length} raw trips ` +
        `(from ${rawTripCount} API entries)`
    );

    return { route, trips: routeTrips, rawTripCount };
  });

  const routeData = await Promise.all(routePromises);

  return routeData;
};

/**
 * Combines trips from all routes and applies vessel-level filtering.
 */
const combineAndFilterTrips = (
  routeData: {
    route: Route;
    trips: ConvexScheduledTrip[];
    rawTripCount: number;
  }[]
): { finalTrips: ConvexScheduledTrip[]; totalFiltered: number } => {
  const logPrefix = "[SYNC TRIPS]";
  // Combine all trips from all routes
  const allRawTrips = routeData.flatMap((data) => data.trips);
  console.log(
    `${logPrefix} Applying vessel-level filtering to ${allRawTrips.length} total trips across all routes`
  );

  // Apply vessel-level filtering to resolve overlapping routes across all terminals
  const filteredTrips = filterOverlappingTrips(allRawTrips);
  const totalFiltered = allRawTrips.length - filteredTrips.length;

  console.log(
    `${logPrefix} Vessel filtering: ${allRawTrips.length} → ${filteredTrips.length} trips (${totalFiltered} filtered out)`
  );

  // Calculate trip estimates using the filtered, chronologically ordered trips
  const finalTrips = calculateTripEstimates(filteredTrips);

  console.log(
    `${logPrefix} Trip estimates calculated for ${finalTrips.length} trips`
  );

  return { finalTrips, totalFiltered };
};

/**
 * Helper function to add days to a date string.
 */
const addDays = (dateString: string, days: number): string => {
  const date = new Date(dateString);
  date.setDate(date.getDate() + days);
  return formatPacificDate(date);
};
