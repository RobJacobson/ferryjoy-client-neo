/**
 * Snapshot loader for one orchestrator ping.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import type { ConvexVesselTrip } from "functions/vesselTrips/schemas";

export type OrchestratorSnapshot = {
  vesselsIdentity: ReadonlyArray<VesselIdentity>;
  terminalsIdentity: ReadonlyArray<TerminalIdentity>;
  activeTrips: ReadonlyArray<ConvexVesselTrip>;
};

/**
 * Loads identity and active-trip baseline rows needed for one ping.
 *
 * This loader defines the read-model contract between the action pipeline and
 * the query module. It bundles required identity and active-trip rows once so
 * downstream stages run from a consistent baseline and avoid repeated reads.
 * Keeping the guard here localizes a critical invariant: orchestration cannot
 * proceed when identity tables are empty, because location normalization and
 * trip inference both depend on those tables being populated.
 *
 * @param ctx - Convex action context used for the internal read-model query
 * @returns Snapshot used by location and trip stages
 */
export const loadOrchestratorSnapshot = async (
  ctx: ActionCtx
): Promise<OrchestratorSnapshot> => {
  const snapshot = await ctx.runQuery(
    internal.functions.vesselOrchestrator.query.queries.getOrchestratorModelData
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
