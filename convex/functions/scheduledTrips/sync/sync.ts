import type { ActionCtx } from "_generated/server";
import { runTransformationPipeline } from "../../../domain/scheduledTrips/transform/index";
import { getSailingDay } from "../../../shared/time";
import { downloadAllRouteData, fetchActiveRoutes } from "./fetching";
import { saveFinalTrips } from "./persistence";
import type { DaySyncResult } from "./types";

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
  totalIndirect: number;
  daysProcessed: DaySyncResult[];
}> => {
  const results: DaySyncResult[] = [];
  let totalDeleted = 0;
  let totalInserted = 0;
  let totalIndirect = 0;

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
      totalIndirect += result.totalIndirect;
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
    totalIndirect,
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
  totalIndirect: number;
}> => {
  try {
    console.log(`${logPrefix} Starting scheduled trips sync for ${targetDate}`);

    // Phase 1: Fetch all active routes
    console.log(`${logPrefix}Fetching routes for ${targetDate}`);
    const routes = await fetchActiveRoutes(targetDate);
    console.log(
      `${logPrefix}Found ${routes.length} routes:`,
      routes
        .map((r) => `${r.RouteID} (${r.RouteAbbrev || "no abbrev"})`)
        .join(", ")
    );

    if (routes.length === 0) {
      console.log(`${logPrefix}No routes found for ${targetDate}`);
      return { deleted: 0, inserted: 0, routesProcessed: 0, totalIndirect: 0 };
    }

    // Phase 2: Download ALL fresh data before making any changes
    const routeData = await downloadAllRouteData(routes, targetDate);

    // Phase 3: Combine and classify trips
    const allRawTrips = routeData.flatMap((data) => data.trips);
    console.log(
      `${logPrefix} Applying vessel-level classification to ${allRawTrips.length} total trips across all routes`
    );

    // Run the core transformation pipeline (classification and estimates)
    const finalTrips = runTransformationPipeline(allRawTrips);

    const totalIndirect = finalTrips.filter(
      (trip) => trip.TripType === "indirect"
    ).length;

    console.log(
      `${logPrefix} Vessel classification: ${allRawTrips.length} total trips, ` +
        `${finalTrips.length - totalIndirect} direct, ${totalIndirect} indirect`
    );

    console.log(
      `${logPrefix} Trip estimates calculated for ${finalTrips.length} trips`
    );

    // Phase 4: Only now that we have all data, perform safe replacement
    const { deleted, inserted } = await saveFinalTrips(
      ctx,
      targetDate,
      finalTrips
    );

    console.log(
      `${logPrefix}Safe sync completed: deleted ${deleted}, inserted ${inserted}, ` +
        `${totalIndirect} indirect trips across ${routeData.length} routes`
    );

    return {
      deleted,
      inserted,
      routesProcessed: routeData.length,
      totalIndirect,
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
 * Helper function to add days to a date string.
 * @param dateString - Date string in YYYY-MM-DD format
 * @param days - Number of days to add (can be negative)
 * @returns New date string in YYYY-MM-DD format
 */
const addDays = (dateString: string, days: number): string => {
  // NOTE: `new Date("YYYY-MM-DD")` is parsed as UTC midnight, which can shift the
  // Pacific date backward. Use UTC math anchored at noon to keep date arithmetic
  // stable across time zones and DST.
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return getSailingDay(date);
};
