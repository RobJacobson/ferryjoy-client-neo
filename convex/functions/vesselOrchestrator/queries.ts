/**
 * Internal read models for the vessel orchestrator action.
 *
 * Bundles DB snapshots that the orchestrator needs each tick so one query
 * replaces separate vessel, terminal, and active-trip round trips from actions.
 * Active trips are **storage-native** (no `eventsPredicted` join); public
 * queries load predicted rows via `eventsPredicted` queries and merge with
 * `mergeTripsWithPredictions` for API parity instead.
 */

import { internalQuery } from "_generated/server";
import { v } from "convex/values";
import { terminalIdentitySchema } from "functions/terminals/schemas";
import { vesselIdentitySchema } from "functions/vessels/schemas";
import { vesselTripStoredSchema } from "functions/vesselTrips/schemas";
import { stripConvexMeta } from "shared/stripConvexMeta";

const orchestratorTickReadModelSchema = v.object({
  vessels: v.array(vesselIdentitySchema),
  terminals: v.array(terminalIdentitySchema),
  activeTrips: v.array(vesselTripStoredSchema),
});

/**
 * Load vessels, terminals, and active trips in one transaction for one tick.
 *
 * Matches vessel/terminal shapes used elsewhere; active trips match persisted
 * `activeVesselTrips` rows (not `getActiveTrips`, which enriches them with
 * predictions for subscribers).
 *
 * @param ctx - Convex query context
 * @returns Stripped vessel rows, terminal rows, and storage-native active trips
 */
export const getOrchestratorTickReadModelInternal = internalQuery({
  args: {},
  returns: orchestratorTickReadModelSchema,
  handler: async (ctx) => {
    const [vessels, terminals, trips] = await Promise.all([
      ctx.db.query("vesselsIdentity").collect(),
      ctx.db.query("terminalsIdentity").collect(),
      ctx.db.query("activeVesselTrips").collect(),
    ]);

    return {
      vessels: vessels.map(stripConvexMeta),
      terminals: terminals.map(stripConvexMeta),
      activeTrips: trips.map(stripConvexMeta),
    };
  },
});
