/**
 * Snapshot loader for one orchestrator ping.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";

export type OrchestratorSnapshot = {
  vesselsIdentity: ReadonlyArray<VesselIdentity>;
  terminalsIdentity: ReadonlyArray<TerminalIdentity>;
};

/**
 * Loads vessel and terminal identity rows needed for one ping (Stage 1
 * normalization).
 *
 * Runs before the WSF fetch so normalization can resolve identities. Active
 * trips for changed vessels load inside **`bulkUpsertVesselLocations`** (same
 * mutation as location writes); see `functions/vesselLocation/mutations.ts`.
 * Throws when either identity table is empty so bad deploys fail loudly.
 *
 * @param ctx - Convex action context used for the internal read-model query
 * @returns Identity snapshot for location normalization
 */
export const loadSnapshot = async (
  ctx: ActionCtx
): Promise<OrchestratorSnapshot> => {
  const snapshot = await ctx.runQuery(
    internal.functions.vesselOrchestrator.queries.orchestratorSnapshotQueries
      .getOrchestratorIdentities
  );
  if (
    snapshot.vesselsIdentity.length === 0 ||
    snapshot.terminalsIdentity.length === 0
  ) {
    throw new Error(
      "vesselsIdentity or terminalsIdentity empty; orchestrator ping cannot proceed."
    );
  }
  return snapshot;
};
