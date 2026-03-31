/**
 * Convex action entrypoints for backend vessel sync.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import { action, internalAction } from "_generated/server";
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
 * Refresh the backend vessel table from WSF basics and persist the snapshot.
 *
 * Failures are reported without mutating the existing table so prior data
 * remains available to the rest of the system.
 *
 * @param ctx - Convex internal action context
 */
export const refreshBackendVessels = internalAction({
  args: {},
  handler: async (ctx) => refreshBackendVesselsImpl(ctx),
});

/**
 * Public entry point for `bunx convex run`, `convex:repopulate-vessels`, and
 * optional `convex:dev:with-repopulate`.
 * Same idempotent behavior as {@link refreshBackendVessels}; callable from
 * the CLI because internal actions are not. Harden before exposing broadly in
 * production clients if abuse becomes a concern.
 *
 * @param ctx - Convex public action context
 */
export const runRefreshBackendVessels = action({
  args: {},
  handler: async (ctx) => refreshBackendVesselsImpl(ctx),
});

/**
 * Shared handler for internal cron and public `convex run` / dev bootstrap.
 *
 * @param ctx - Convex action context
 */
async function refreshBackendVesselsImpl(ctx: ActionCtx): Promise<void> {
  try {
    await refreshBackendVesselsOrThrow(ctx);
  } catch (error) {
    const normalized = normalizeUnknownError(error);
    console.error("refreshBackendVessels failed:", normalized);
    throw normalized;
  }
}

/**
 * Refresh the backend vessel table and throw on failure.
 *
 * @param ctx - Convex action context
 */
export async function refreshBackendVesselsOrThrow(
  ctx: ActionCtx
): Promise<void> {
  const fetchedVessels = await fetchVesselBasics();
  const updatedAt = Date.now();
  const vessels: Array<Vessel> = fetchedVessels
    .filter(hasVesselIdentity)
    .map((vessel) => ({
      VesselID: vessel.VesselID,
      VesselName: vessel.VesselName.trim(),
      VesselAbbrev: vessel.VesselAbbrev.trim(),
      UpdatedAt: updatedAt,
    }));

  await ctx.runMutation(
    internal.functions.vesselLocation.mutations.replaceBackendVessels,
    {
      vessels,
    }
  );
}

/**
 * Load the backend vessel snapshot for one action tick.
 *
 * If the table is empty, bootstrap it immediately from WSF basics so callers
 * do not need to wait for the hourly refresh cron.
 *
 * @param ctx - Convex action context for database operations
 * @returns Backend vessels for the current action
 */
export async function loadBackendVesselsOrThrow(
  ctx: ActionCtx
): Promise<Array<Vessel>> {
  let vessels: Array<Vessel> = await ctx.runQuery(
    internal.functions.vesselLocation.queries.getAllBackendVesselsInternal
  );

  if (vessels.length > 0) {
    return vessels;
  }

  await refreshBackendVesselsOrThrow(ctx);

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
 * Narrow raw WSF vessel basics to rows that contain the identity fields
 * required by the backend vessel table.
 *
 * @param vessel - Raw WSF vessel basics row
 * @returns True when the row contains both vessel name and abbreviation
 */
const hasVesselIdentity = (
  vessel: VesselBasic
): vessel is VesselBasicWithIdentity =>
  Boolean(vessel.VesselName && vessel.VesselAbbrev);

/**
 * Normalize unknown thrown values into an Error with useful detail.
 *
 * Convex can surface structured error payloads that stringify to
 * `[object Object]`, so prefer JSON serialization when possible.
 *
 * @param error - Unknown thrown value
 * @returns Normalized Error instance with a readable message
 */
const normalizeUnknownError = (error: unknown) => {
  if (error instanceof Error) {
    return error;
  }

  return new Error(safeSerialize(error));
};

/**
 * Serialize unknown values for logging.
 *
 * @param value - Unknown value to stringify
 * @returns Readable string representation for logs
 */
const safeSerialize = (value: unknown) => {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};
