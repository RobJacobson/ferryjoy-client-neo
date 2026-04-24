/**
 * Internal read models for the vessel orchestrator action.
 *
 * Bundles DB snapshots that the orchestrator needs each ping so one query
 * replaces separate vessel, terminal, and active-trip round trips from actions.
 * Active trips are **storage-native** (no `eventsPredicted` join); public
 * queries load predicted rows via `eventsPredicted` queries and merge with
 * `mergeTripsWithPredictions` for API parity instead.
 */

import { internalQuery } from "_generated/server";
import { v } from "convex/values";
import { terminalIdentitySchema } from "functions/terminals/schemas";
import { storedVesselLocationSchema } from "functions/vesselOrchestrator/schemas";
import { vesselIdentitySchema } from "functions/vessels/schemas";
import { vesselTripStoredSchema } from "functions/vesselTrips/schemas";
import { stripConvexMeta } from "shared/stripConvexMeta";

/** Return validator for {@link getOrchestratorModelData}. */
const orchestratorModelDataSchema = v.object({
  vesselsIdentity: v.array(vesselIdentitySchema),
  terminalsIdentity: v.array(terminalIdentitySchema),
  activeTrips: v.array(vesselTripStoredSchema),
  storedLocations: v.array(storedVesselLocationSchema),
});

/**
 * Load vessels, terminals, and active trips in one transaction for one ping.
 *
 * Matches vessel/terminal shapes used elsewhere; active trips match persisted
 * `activeVesselTrips` rows (not `getActiveTrips`, which enriches them with
 * predictions for subscribers).
 *
 * @param ctx - Convex query context
 * @returns Stripped vessel rows, terminal rows, and storage-native active trips
 */
export const getOrchestratorModelData = internalQuery({
  args: {},
  returns: orchestratorModelDataSchema,
  handler: async (ctx) => {
    const [vessels, terminals, trips, storedLocations] = await Promise.all([
      ctx.db.query("vesselsIdentity").collect(),
      ctx.db.query("terminalsIdentity").collect(),
      ctx.db.query("activeVesselTrips").collect(),
      ctx.db.query("vesselLocations").collect(),
    ]);

    return {
      vesselsIdentity: vessels.map(stripConvexMeta),
      terminalsIdentity: terminals.map(stripConvexMeta),
      activeTrips: trips.map(stripConvexMeta),
      storedLocations: storedLocations.map((row) => {
        const { _creationTime: _ignoredCreationTime, ...rest } = row;
        return rest;
      }),
    };
  },
});
