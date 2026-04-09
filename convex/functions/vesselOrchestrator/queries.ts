/**
 * Internal read models for the vessel orchestrator action.
 *
 * Bundles DB snapshots that the orchestrator needs each tick so one query
 * replaces separate vessel, terminal, and active-trip round trips from actions.
 */

import { internalQuery } from "_generated/server";
import { v } from "convex/values";
import { terminalSchema } from "functions/terminals/schemas";
import { vesselSchema } from "functions/vessels/schemas";
import { hydrateStoredTripsWithPredictions } from "functions/vesselTrips/hydrateTripPredictions";
import { vesselTripSchema } from "functions/vesselTrips/schemas";
import { stripConvexMeta } from "shared/stripConvexMeta";

const orchestratorTickReadModelSchema = v.object({
  vessels: v.array(vesselSchema),
  terminals: v.array(terminalSchema),
  activeTrips: v.array(vesselTripSchema),
});

/**
 * Load vessels, terminals, and active trips in one transaction for one tick.
 *
 * Matches the data shapes of `getAllBackendVesselsInternal`,
 * `getAllBackendTerminalsInternal`, and `getActiveTrips` without three separate
 * `ctx.runQuery` calls from the orchestrator action.
 *
 * @param ctx - Convex query context
 * @returns Stripped vessel rows, terminal rows, and active trip rows
 */
export const getOrchestratorTickReadModelInternal = internalQuery({
  args: {},
  returns: orchestratorTickReadModelSchema,
  handler: async (ctx) => {
    const [vessels, terminals, trips] = await Promise.all([
      ctx.db.query("vessels").collect(),
      ctx.db.query("terminals").collect(),
      ctx.db.query("activeVesselTrips").collect(),
    ]);

    const activeTripsHydrated = await hydrateStoredTripsWithPredictions(
      ctx,
      trips
    );

    return {
      vessels: vessels.map(stripConvexMeta),
      terminals: terminals.map(stripConvexMeta),
      activeTrips: activeTripsHydrated.map(stripConvexMeta),
    };
  },
});
