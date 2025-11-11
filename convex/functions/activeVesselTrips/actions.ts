/* eslint-disable @typescript-eslint/no-explicit-any */
/** biome-ignore-all lint/suspicious/noExplicitAny: hardcoded fields */

import { internalAction } from "@convex/_generated/server";

import { orchestrateVesselTripUpdates } from "../../domain/tripOperations/tripOrchestrator";

/**
 * Main action for updating vessel trips by fetching current data from WSF API and syncing with database.
 * This action runs on a cron job every 15 seconds to keep vessel trip data current.
 * It handles three main operations:
 * 1. Processing completed trips (moving them to completed table)
 * 2. Inserting new trips for vessels that have started new journeys
 * 3. Updating existing in-progress trips with any changes
 *
 * @param ctx - The Convex action context providing access to run queries and mutations
 */
export const updateVesselTrips = internalAction({
  args: {},
  handler: async (ctx) => {
    await orchestrateVesselTripUpdates(ctx);
  },
});
