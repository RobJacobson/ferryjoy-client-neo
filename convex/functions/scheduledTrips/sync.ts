/**
 * Orchestration for scheduled-trips sync: date-range loops, adapter ingress, and
 * persistence via `replaceScheduledTripsForSailingDay`. Convex actions in
 * `actions.ts` call into this module.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { fetchAndTransformScheduledTrips } from "adapters";
import { getSailingDay } from "../../shared/time";
import { loadTerminalIdentities } from "../terminals/actions";
import { loadVesselIdentities } from "../vessels/actions";

const logPrefix = "[SYNC TRIPS]";

/**
 * Per-day status for a windowed scheduled-trips sync run.
 */
type DaySyncResult = {
  sailingDay: string;
  action: "synced" | "failed";
  error?: string;
};

/**
 * Syncs scheduled trips for a range of consecutive sailing days.
 *
 * Calls `syncScheduledTripsForDate` per day with `addDays`, aggregates delete/insert
 * totals, and records per-day success or failure without aborting the window.
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
 * Syncs `scheduledTrips` for one sailing day using a download-first replace.
 *
 * Builds the full transformed trip list via `fetchAndTransformScheduledTrips`, then
 * replaces the day atomically in `replaceScheduledTripsForSailingDay` so readers
 * never see a partial delete.
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
    const vessels = await loadVesselIdentities(ctx);
    const terminals = await loadTerminalIdentities(ctx);
    const { routes, routeData, rawTrips, finalTrips, totalIndirect } =
      await fetchAndTransformScheduledTrips(targetDate, vessels, terminals);
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
    console.log(
      `${logPrefix} Applying vessel-level classification to ${rawTrips.length} total trips across all routes`
    );

    console.log(
      `${logPrefix} Vessel classification: ${rawTrips.length} total trips, ` +
        `${finalTrips.length - totalIndirect} direct, ${totalIndirect} indirect`
    );

    console.log(
      `${logPrefix} Trip estimates calculated for ${finalTrips.length} trips`
    );

    // Phase 4: Replace persisted rows for this sailing day in one mutation.
    console.log(
      `${logPrefix} Replacing DB rows for ${targetDate} (${finalTrips.length} trips)`
    );
    const { deleted, inserted } = await ctx.runMutation(
      internal.functions.scheduledTrips.mutations
        .replaceScheduledTripsForSailingDay,
      { sailingDay: targetDate, trips: finalTrips }
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
 * Adds whole calendar days to a YYYY-MM-DD sailing-day string.
 *
 * Anchors at UTC noon so Pacific sailing-day arithmetic does not shift across
 * DST or parse quirks from midnight UTC.
 *
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
