/**
 * Internal read models for the vessel orchestrator action.
 */

import { internalQuery } from "_generated/server";
import { v } from "convex/values";
import { terminalIdentitySchema } from "functions/terminals/schemas";
import { vesselIdentitySchema } from "functions/vessels/schemas";
import { vesselTripStoredSchema } from "functions/vesselTrips/schemas";
import { stripConvexMeta } from "shared/stripConvexMeta";

const orchestratorModelDataSchema = v.object({
  vesselsIdentity: v.array(vesselIdentitySchema),
  terminalsIdentity: v.array(terminalIdentitySchema),
  activeTrips: v.array(vesselTripStoredSchema),
});

/**
 * Loads the baseline orchestrator read model in one query transaction.
 *
 * @param ctx - Convex query context for database reads
 * @returns Identity rows and storage-native active trip rows
 */
export const getOrchestratorModelData = internalQuery({
  args: {},
  returns: orchestratorModelDataSchema,
  handler: async (ctx) => {
    const [vessels, terminals, trips] = await Promise.all([
      ctx.db.query("vesselsIdentity").collect(),
      ctx.db.query("terminalsIdentity").collect(),
      ctx.db.query("activeVesselTrips").collect(),
    ]);

    return {
      vesselsIdentity: vessels.map(stripConvexMeta),
      terminalsIdentity: terminals.map(stripConvexMeta),
      activeTrips: trips.map(stripConvexMeta),
    };
  },
});
