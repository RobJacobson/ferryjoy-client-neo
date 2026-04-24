/**
 * Focused vessel-orchestrator test helpers.
 *
 * This keeps test helpers out of the production orchestrator action
 * so the hot-path file stays centered on real runtime concerns.
 */

import { internal } from "_generated/api";
import type { ActionCtx } from "_generated/server";
import type { TerminalIdentity } from "functions/terminals/schemas";
import type { ConvexVesselLocation } from "functions/vesselLocation/schemas";
import type { VesselIdentity } from "functions/vessels/schemas";
import {
  buildChangedLocationWrites,
  loadVesselLocationUpdates,
} from "./locationUpdates";
import { buildOrchestratorPersistenceBundle } from "./persistenceBundle";

/**
 * Focused helper for location tests.
 *
 * @param ctx - Action context for snapshot and persistence calls
 * @param pingStartedAt - Orchestrator-owned ping anchor
 * @param vesselsIdentity - Backend vessel rows for feed resolution
 * @param terminalsIdentity - Backend terminal rows for normalization
 * @returns Normalized current vessel-location rows
 */
export const updateVesselLocations = async (
  ctx: ActionCtx,
  pingStartedAt: number,
  vesselsIdentity: ReadonlyArray<VesselIdentity>,
  terminalsIdentity: ReadonlyArray<TerminalIdentity>
): Promise<ReadonlyArray<ConvexVesselLocation>> => {
  const snapshot = await ctx.runQuery(
    internal.functions.vesselOrchestrator.queries.getOrchestratorModelData
  );
  const locationUpdates = await loadVesselLocationUpdates({
    pingStartedAt,
    storedLocations: snapshot.storedLocations,
    terminalsIdentity,
    vesselsIdentity,
  });
  const changedLocations = buildChangedLocationWrites(
    locationUpdates.filter((update) => update.locationChanged)
  );

  if (changedLocations.length > 0) {
    await ctx.runMutation(
      internal.functions.vesselOrchestrator.mutations.persistOrchestratorPing,
      buildOrchestratorPersistenceBundle({
        pingStartedAt,
        changedLocations: [...changedLocations],
        existingActiveTrips: [],
        tripRows: { activeTrips: [], completedTrips: [] },
        predictionRows: [],
        mlTimelineOverlays: [],
      })
    );
  }

  return locationUpdates.map((update) => update.vesselLocation);
};
