/**
 * Orchestrator identity read models: vessel and terminal rows used to normalize
 * the WSF location feed before Stage 1 writes. No trip or location tables.
 */

import { internalQuery } from "_generated/server";
import { v } from "convex/values";
import { terminalIdentitySchema } from "functions/terminals/schemas";
import { vesselIdentitySchema } from "functions/vessels/schemas";
import { stripConvexMeta } from "shared/stripConvexMeta";

const orchestratorIdentitiesSchema = v.object({
  vesselsIdentity: v.array(vesselIdentitySchema),
  terminalsIdentity: v.array(terminalIdentitySchema),
});

/**
 * Loads vessel and terminal identity rows for one orchestrator ping.
 *
 * Runs once per ping before the WSF fetch so normalization can resolve vessel
 * names, IDs, and passenger-terminal geography. Does not load `vesselLocations`
 * or `activeVesselTrips`; active trips for changed vessels are read inside
 * `bulkUpsertVesselLocations` after location writes. Fails fast upstream if
 * either identity table is empty (seed or identity sync required).
 *
 * @param ctx - Convex query context for database reads
 * @returns Plain identity rows without Convex document metadata
 */
export const getOrchestratorIdentities = internalQuery({
  args: {},
  returns: orchestratorIdentitiesSchema,
  handler: async (ctx) => {
    const [vessels, terminals] = await Promise.all([
      ctx.db.query("vesselsIdentity").collect(),
      ctx.db.query("terminalsIdentity").collect(),
    ]);

    return {
      vesselsIdentity: vessels.map(stripConvexMeta),
      terminalsIdentity: terminals.map(stripConvexMeta),
    };
  },
});
