import { action, internalAction } from "_generated/server";
import {
  performScheduledTripsSync,
  verifyScheduledTripsForRoute,
} from "./actions/";

/**
 * Internal action for syncing scheduled trips data
 * This will eventually be called by a cron job
 *
 * @returns Sync result with statistics
 */
export const syncScheduledTrips = internalAction({
  args: {},
  handler: async (ctx) => performScheduledTripsSync(ctx),
});

/**
 * Manual trigger for testing scheduled trips sync
 * Uses shared sync logic to avoid code duplication
 */
export const syncScheduledTripsManual = action({
  args: {},
  handler: async (ctx) => performScheduledTripsSync(ctx, "[MANUAL] "),
});

/**
 * Public action for verifying scheduled trips data consistency
 * Compares WSF API data with Convex database for debugging
 */
export { verifyScheduledTripsForRoute };
