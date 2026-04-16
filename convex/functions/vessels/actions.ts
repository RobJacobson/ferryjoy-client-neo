/**
 * Convex action entrypoints for backend vessel sync.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { action, internalAction } from "_generated/server";
import { v } from "convex/values";
import {
  fetchVesselBasics,
  type VesselBasic,
} from "ws-dottie/wsf-vessels/core";
import type { Vessel } from "./schemas";

type VesselBasicWithIdentity = VesselBasic & {
  VesselName: string;
  VesselAbbrev: string;
};

/**
 * Internal cron entry: fetch WSF vessel basics and replace the backend
 * `vessels` snapshot.
 *
 * @param ctx - Convex internal action context
 * @returns `null` after the backend snapshot refresh completes
 */
export const syncBackendVessels = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await syncBackendVesselTable(ctx);
    return null;
  },
});

/**
 * Public entry for `bunx convex run`, `convex:repopulate-vessels`, and
 * `convex:dev:with-repopulate`. Internal actions are not runnable from the CLI.
 *
 * @param ctx - Convex public action context
 * @returns `null` after the backend snapshot refresh completes
 */
export const runSyncBackendVessels = action({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await syncBackendVesselTable(ctx);
    return null;
  },
});

/**
 * Load the backend vessel snapshot for one action tick.
 *
 * If the table is empty, bootstrap it immediately from WSF basics so callers
 * do not need to wait for the hourly refresh cron.
 *
 * @param ctx - Convex action context for database operations
 * @returns Backend vessels for the current action
 */
export async function loadBackendVessels(
  ctx: ActionCtx
): Promise<Array<Vessel>> {
  let vessels: Array<Vessel> = await ctx.runQuery(
    internal.functions.vesselLocation.queries.getAllBackendVesselsInternal
  );

  if (vessels.length > 0) {
    return vessels;
  }

  await syncBackendVesselTable(ctx);

  vessels = await ctx.runQuery(
    internal.functions.vesselLocation.queries.getAllBackendVesselsInternal
  );

  if (vessels.length === 0) {
    throw new Error(
      "Backend vessels table is still empty after bootstrap refresh."
    );
  }

  return vessels;
}

/**
 * Fetch WSF vessel basics and replace the backend `vessels` snapshot.
 *
 * Shared by {@link syncBackendVessels}, {@link runSyncBackendVessels},
 * {@link loadBackendVessels}, and orchestrator bootstrap.
 *
 * @param ctx - Convex action context
 * @returns `undefined` after the backend snapshot is fully replaced
 */
export async function syncBackendVesselTable(ctx: ActionCtx): Promise<void> {
  const fetchedVessels = await fetchVesselBasics();
  const updatedAt = Date.now();
  const vessels: Array<Vessel> = fetchedVessels
    .filter(hasVesselIdentity)
    .map((vessel) => toBackendVessel(vessel, updatedAt));

  await ctx.runMutation(
    internal.functions.vesselLocation.mutations.replaceBackendVessels,
    {
      vessels,
    }
  );
}

/**
 * Narrow raw WSF vessel basics to rows that contain the identity fields
 * required for the backend vessel table.
 *
 * @param vessel - Raw WSF vessel basics row
 * @returns True when the row contains both vessel name and abbreviation
 */
const hasVesselIdentity = (
  vessel: VesselBasic
): vessel is VesselBasicWithIdentity =>
  Boolean(vessel.VesselName && vessel.VesselAbbrev);

/**
 * Maps one WSF vessel basics row into the backend vessel snapshot shape.
 *
 * @param vessel - WSF vessel basics row with required identity fields
 * @param updatedAt - Shared snapshot refresh timestamp
 * @returns Backend vessel snapshot row ready for persistence
 */
const toBackendVessel = (
  vessel: VesselBasicWithIdentity,
  updatedAt: number
): Vessel => ({
  VesselID: vessel.VesselID,
  VesselName: vessel.VesselName.trim(),
  VesselAbbrev: vessel.VesselAbbrev.trim(),
  UpdatedAt: updatedAt,
});
