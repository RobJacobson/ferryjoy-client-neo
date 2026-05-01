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
 * @param ctx - Convex action context used for the internal read-model query
 * @returns Snapshot used by location and trip stages
 */
export const loadOrchestratorSnapshot = async (
  ctx: ActionCtx
): Promise<OrchestratorSnapshot> => {
  const snapshot = await ctx.runQuery(
    internal.functions.vesselOrchestrator.queries.getOrchestratorModelData
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
