import type { ActionCtx } from "_generated/server";
import { ConvexError } from "convex/values";
import type { Route } from "ws-dottie/wsf-schedule";
import { fetchRoutesByTripDate } from "ws-dottie/wsf-schedule";
import { retryOnce, syncRoute } from "./shared";
import type { RouteSyncResult } from "./types";

/**
 * Shared logic for syncing scheduled trips data with atomic per-route operations
 * Uses new syncScheduledTripsForRoute mutation for consistency and performance
 */
export const performScheduledTripsSync = async (
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

    // Step 2: Process each route atomically (continue on individual failures)
    const syncResults: RouteSyncResult[] = [];

    for (const route of routes) {
      try {
        const result = await syncRoute(ctx, route, today, logPrefix);
        syncResults.push(result);
      } catch (error) {
        console.error(
          `${logPrefix}Failed to sync route ${route.RouteID}, continuing with others:`,
          error
        );
        // Continue with other routes instead of failing completely
      }
    }

    // Step 3: Report aggregate results
    const totals = syncResults.reduce(
      (acc, result) => ({
        routes: acc.routes + 1,
        inserted: acc.inserted + result.results.inserted,
        updated: acc.updated + result.results.updated,
        deleted: acc.deleted + result.results.deleted,
      }),
      { routes: 0, inserted: 0, updated: 0, deleted: 0 }
    );

    console.log(
      `${logPrefix}Scheduled trips sync completed: ${totals.routes} routes, ` +
        `+${totals.inserted} inserted, ~${totals.updated} updated, -${totals.deleted} deleted`
    );

    if (totals.routes === 0) {
      throw new ConvexError({
        message: `No routes could be synced for ${today}`,
        code: "NO_ROUTES_SYNCED",
        severity: "error",
      });
    }
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
