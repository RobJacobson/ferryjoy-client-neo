import { api } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { ConvexError } from "convex/values";
import type { Route } from "ws-dottie/wsf-schedule";
import { fetchRoutesByTripDate } from "ws-dottie/wsf-schedule";
import type { ConvexScheduledTrip } from "../schemas";
import {
  fetchRouteSchedule,
  filterOverlappingTrips,
  flattenScheduleToTrips,
  retryOnce,
} from "./shared";

/**
 * Simplified sync function that downloads fresh data before deleting existing data.
 * This approach ensures we never lose all data due to network errors.
 *
 * Process:
 * 1. Fetch all active routes for the target date
 * 2. Download fresh schedule data for all routes (fail fast if any download fails)
 * 3. Only after successful download, delete all existing trips for the target date
 * 4. Insert all the fresh downloaded data
 *
 * @param ctx - Convex action context for database operations
 * @param targetDate - Target trip date in YYYY-MM-DD format to synchronize
 * @param logPrefix - Prefix for log messages
 * @returns Summary of the sync operation
 */
export const syncScheduledTripsForDate = async (
  ctx: ActionCtx,
  targetDate: string,
  logPrefix: string = ""
): Promise<{ deleted: number; inserted: number; deduplicated: number; routesProcessed: number }> => {
  try {
    console.log(
      `${logPrefix}Starting SAFE scheduled trips sync for ${targetDate}`
    );

    // Phase 1: Fetch all active routes
    console.log(`${logPrefix}Fetching routes for ${targetDate}`);
    const routes: Route[] = await retryOnce(() =>
      fetchRoutesByTripDate({ params: { TripDate: targetDate } })
    );
    console.log(
      `${logPrefix}Found ${routes.length} routes:`,
      routes
        .map((r) => `${r.RouteID} (${r.RouteAbbrev || "no abbrev"})`)
        .join(", ")
    );

    if (routes.length === 0) {
      console.log(`${logPrefix}No routes found for ${targetDate}`);
      return { deleted: 0, inserted: 0, routesProcessed: 0 };
    }

    // Phase 2: Download ALL fresh data before making any changes
    console.log(`${logPrefix}Downloading fresh data for all routes`);
    const routeData: {
      route: Route;
      trips: ConvexScheduledTrip[];
      rawTripCount: number;
    }[] = [];

    for (const route of routes) {
      console.log(
        `${logPrefix}Downloading route ${route.RouteID} (${route.RouteAbbrev || "no abbrev"})`
      );

      // Fetch schedule data
      const schedule = await fetchRouteSchedule(route.RouteID, targetDate);

      // Convert to trips (raw data only, skip filtering)
      const rawTripCount = schedule.TerminalCombos.flatMap(
        (terminalCombo) => (terminalCombo.Times as VesselSailing[]).length
      ).reduce((sum, count) => sum + count, 0);

      const routeTrips = flattenScheduleToTrips(schedule, route, targetDate);

      console.log(
        `${logPrefix}Route ${route.RouteID} downloaded ${routeTrips.length} raw trips ` +
          `(from ${rawTripCount} API entries)`
      );

      routeData.push({ route, trips: routeTrips, rawTripCount });
    }

    // Combine all trips from all routes (no complex filtering needed)
    const finalTrips = routeData.flatMap((data) => data.trips);

    const totalTripsDownloaded = finalTrips.length;

    console.log(
      `${logPrefix}Successfully downloaded ${totalTripsDownloaded} trips across ${routeData.length} routes`
    );

    // Phase 3: Only now that we have all data, delete existing data
    console.log(`${logPrefix}Deleting all existing trips for ${targetDate}`);
    const deleteResult = await ctx.runMutation(
      api.functions.scheduledTrips.mutations.deleteScheduledTripsForDate,
      { sailingDay: targetDate }
    );
    console.log(
      `${logPrefix}Deleted ${deleteResult.deleted} existing trips for ${targetDate}`
    );

    // Phase 4: Insert all the fresh downloaded data with deduplication
    console.log(`${logPrefix}Inserting fresh data with deduplication`);
    let totalInserted = 0;
    let totalDeduplicated = 0;

    if (finalTrips.length > 0) {
      const insertResult = await ctx.runMutation(
        api.functions.scheduledTrips.mutations.insertScheduledTrips,
        { trips: finalTrips }
      );
      totalInserted = insertResult.inserted;
      totalDeduplicated = insertResult.deduplicated;
      console.log(
        `${logPrefix}Inserted ${totalInserted} new trips, updated ${totalDeduplicated} existing trips`
      );
    }

    console.log(
      `${logPrefix}Safe sync completed: deleted ${deleteResult.deleted}, inserted ${totalInserted}, deduplicated ${totalDeduplicated} trips across ${routeData.length} routes`
    );

    return {
      deleted: deleteResult.deleted,
      inserted: totalInserted,
      deduplicated: totalDeduplicated,
      routesProcessed: routeData.length,
    };
  } catch (error) {
    console.error(
      `${logPrefix}Safe scheduled trips sync failed for ${targetDate}:`,
      error
    );
    throw new ConvexError({
      message: `Safe scheduled trips sync failed for ${targetDate}`,
      code: "SAFE_SYNC_SCHEDULED_TRIPS_FAILED",
      severity: "error",
      details: { targetDate, error: String(error) },
    });
  }
};
