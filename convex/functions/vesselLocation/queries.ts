/**
 * Query handlers for live vessel locations and the `vesselsIdentity` snapshot
 * (concise vessel identity rows, not full vessel operational records).
 */

import { internalQuery, query } from "_generated/server";
import { v } from "convex/values";
import { stripConvexMeta } from "../../shared/stripConvexMeta";
import { vesselIdentitySchema } from "../vessels/schemas";
import { vesselLocationValidationSchema } from "./schemas";

/**
 * Lists every live `vesselLocations` row (full feed snapshot; metadata stripped).
 *
 * Table scan used for coarse map or debug views; hot paths should prefer indexed
 * reads per vessel.
 *
 * @param ctx - Convex query context
 * @returns All current location docs without `_id` / `_creationTime`
 */
export const getAll = query({
  args: {},
  returns: v.array(vesselLocationValidationSchema),
  handler: async (ctx) => {
    const vesselLocations = await ctx.db.query("vesselLocations").collect();
    return vesselLocations.map(stripConvexMeta);
  },
});

/**
 * Loads the current live location for one vessel abbreviation.
 *
 * Returns `null` when no row exists. `unique()` throws if the index is violated
 * so duplicate-key bugs are not silently masked.
 *
 * @param ctx - Convex query context
 * @param args - Query arguments containing the vessel abbreviation
 * @returns Vessel location record without metadata, or `null` if unavailable
 */
export const getByVesselAbbrev = query({
  args: {
    vesselAbbrev: v.string(),
  },
  returns: v.union(vesselLocationValidationSchema, v.null()),
  handler: async (ctx, args) => {
    const vesselLocation = await ctx.db
      .query("vesselLocations")
      .withIndex("by_vessel_abbrev", (q) =>
        q.eq("VesselAbbrev", args.vesselAbbrev)
      )
      .unique();

    return vesselLocation ? stripConvexMeta(vesselLocation) : null;
  },
});

/**
 * Lists all live vessel locations for internal callers (metadata stripped).
 *
 * Same data as `getAll` but exposed as `internalQuery` for orchestrator and
 * backend jobs that must not use public query paths.
 *
 * @param ctx - Convex internal query context
 * @returns All live vessel location rows without Convex metadata
 */
export const getCurrentVesselLocations = internalQuery({
  args: {},
  returns: v.array(vesselLocationValidationSchema),
  handler: async (ctx) => {
    const vesselLocations = await ctx.db.query("vesselLocations").collect();
    return vesselLocations.map(stripConvexMeta);
  },
});

/**
 * Lists all `vesselsIdentity` rows (canonical identity fields only).
 *
 * Excludes live location and trip state; used by orchestrator identity preload
 * and vessel sync actions.
 *
 * @param ctx - Convex internal query context
 * @returns Vessel identity rows without Convex metadata
 */
export const getAllVesselIdentities = internalQuery({
  args: {},
  returns: v.array(vesselIdentitySchema),
  handler: async (ctx) => {
    const vessels = await ctx.db.query("vesselsIdentity").collect();
    return vessels.map(stripConvexMeta);
  },
});

/**
 * Public snapshot of canonical vessel identity data for the app.
 *
 * Empty table returns `null`, not `[]` — same `useLayeredDataset` contract as
 * `getFrontendTerminalsSnapshot`.
 *
 * @param ctx - Convex public query context
 * @returns Vessel snapshot rows without Convex metadata, or `null` when empty
 */
export const getFrontendVesselsSnapshot = query({
  args: {},
  returns: v.union(v.array(vesselIdentitySchema), v.null()),
  handler: async (ctx) => {
    const vessels = await ctx.db.query("vesselsIdentity").collect();

    if (vessels.length === 0) {
      return null;
    }

    return vessels.map(stripConvexMeta);
  },
});
