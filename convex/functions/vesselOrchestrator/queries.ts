/**
 * Internal read models for the vessel orchestrator action.
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
 * Loads vessel and terminal identity rows for one orchestrator ping (no trips).
 *
 * @param ctx - Convex query context for database reads
 * @returns Identity rows for location normalization
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
