/**
 * Internal read models for the vessel orchestrator action.
 */

import { internalQuery } from "_generated/server";
import { v } from "convex/values";
import { terminalIdentitySchema } from "functions/terminals/schemas";
import { vesselIdentitySchema } from "functions/vessels/schemas";
import { vesselTripStoredSchema } from "functions/vesselTrips/schemas";
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

/**
 * Loads active trip rows for the given vessel abbrevs (indexed reads).
 * Call after Stage 1 location writes so trip state matches durable locations
 * for these vessels.
 *
 * @param ctx - Convex query context
 * @param args - Distinct vessel abbreviations (duplicates are ignored)
 * @returns Stored active trips found (omitted vessels have no row)
 */
export const getActiveTripsForVesselAbbrevs = internalQuery({
  args: { vesselAbbrevs: v.array(v.string()) },
  returns: v.array(vesselTripStoredSchema),
  handler: async (ctx, args) => {
    const uniqueAbbrevs = [...new Set(args.vesselAbbrevs)];
    const trips = await Promise.all(
      uniqueAbbrevs.map((abbrev) =>
        ctx.db
          .query("activeVesselTrips")
          .withIndex("by_vessel_abbrev", (q) => q.eq("VesselAbbrev", abbrev))
          .first()
      )
    );
    return trips
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .map(stripConvexMeta);
  },
});
