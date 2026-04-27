/**
 * Internal read models for the vessel orchestrator action.
 */

import { internalQuery } from "_generated/server";
import { v } from "convex/values";
import { terminalIdentitySchema } from "functions/terminals/schemas";
import { vesselLocationValidationSchema } from "functions/vesselLocation/schemas";
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
 * This query is intentionally narrow and storage-native so the action layer can
 * build one consistent ping snapshot without joining prediction overlays or
 * other derived views. Centralizing these reads behind one function reduces
 * round trips and gives the action pipeline a single dependency for baseline
 * state. It also cleanly separates read-model assembly concerns from action
 * sequencing and mutation-side persistence concerns.
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

/**
 * Loads the current persisted live vessel locations for ingest-state lookups.
 *
 * @param ctx - Convex query context for database reads
 * @returns Storage-native live vessel location rows without Convex metadata
 */
export const getCurrentVesselLocationsForIngest = internalQuery({
  args: {},
  returns: v.array(vesselLocationValidationSchema),
  handler: async (ctx) => {
    const locations = await ctx.db.query("vesselLocations").collect();
    return locations.map(stripConvexMeta);
  },
});
